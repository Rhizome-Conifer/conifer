from webrecorder.basecontroller import BaseController
from tempfile import SpooledTemporaryFile, NamedTemporaryFile
from bottle import request

from warcio.archiveiterator import ArchiveIterator
from warcio.limitreader import LimitReader

from har2warc.har2warc import HarParser
from warcio.warcwriter import BufferWARCWriter, WARCWriter

from pywb.cdx.cdxobject import CDXObject

import traceback
import json
import requests
import atexit

import base64
import os
import gevent
import redis

from webrecorder.utils import SizeTrackingReader, CacheingLimitReader, redis_pipeline

import logging
logger = logging.getLogger(__name__)


BLOCK_SIZE = 16384 * 8
EMPTY_DIGEST = '3I42H3S6NNFQ2MSVX7XZKYAYSCX5QBYJ'


# ============================================================================
class UploadController(BaseController):
    def __init__(self, app, jinja_env, manager, config):
        super(UploadController, self).__init__(app, jinja_env, manager, config)
        self.upload_path = config['url_templates']['upload']
        self.cdxj_key = config['cdxj_key_templ']
        self.upload_key = config['upload_key_templ']
        self.upload_exp = int(config['upload_status_expire'])
        self.record_host = os.environ['RECORD_HOST']

        self.upload_collection = config['upload_coll']

    def init_routes(self):
        @self.app.put('/_upload')
        def upload_file():
            return self.upload_file()

        @self.app.get('/_upload/<upload_id>')
        def get_upload_status(upload_id):
            user = self.get_user(api=True)

            props = self.manager.get_upload_status(user, upload_id)

            if not props:
                return {'error_message': 'upload expired'}

            return props

    def upload_file(self):
        stream = None
        temp_file = None
        logger.debug('Upload Begin')

        expected_size = int(request.headers['Content-Length'])

        logger.debug('Expected Size: ' + str(expected_size))

        if not expected_size:
            return {'error_message': 'No File Specified'}

        curr_user = self.manager.get_curr_user()

        if not curr_user:
            #user = self.manager.get_anon_user()
            #force_coll = 'temp'
            #is_anon = True

            return {'error_message': 'Sorry, uploads only available for logged-in users'}

        user = curr_user
        force_coll = request.query.getunicode('force-coll', '')
        is_anon = False

        size_rem = self.manager.get_size_remaining(user)

        logger.debug('User Size Rem: ' + str(size_rem))

        if size_rem < expected_size:
            return {'error_message': 'Sorry, not enough space to upload this file'}

        if force_coll and not self.manager.has_collection(user, force_coll):
            if is_anon:
                self.manager.create_collection(user, force_coll, 'Temporary Collection')

            else:
                status = 'Collection {0} not found'.format(force_coll)
                return {'error_message': status}

        temp_file = SpooledTemporaryFile(max_size=BLOCK_SIZE)

        filename = request.query.getunicode('filename')

        stream = request.environ['wsgi.input']
        stream = CacheingLimitReader(stream, expected_size, temp_file)

        if filename.endswith('.har'):
            stream, expected_size = self.har2warc(filename, stream)
            temp_file.close()
            temp_file = stream

        infos = self.parse_uploaded(stream, expected_size)

        total_size = temp_file.tell()
        if total_size != expected_size:
            return {'error_message': 'size mismatch: expected {0}, got {1}'.format(expected_size, total_size)}

        upload_id = self._get_upload_id()

        upload_key = self.upload_key.format(user=user, upid=upload_id)

        with redis_pipeline(self.manager.redis) as pi:
            pi.hset(upload_key, 'size', 0)
            pi.hset(upload_key, 'total_size', total_size * 2)
            pi.hset(upload_key, 'filename', filename)
            pi.hset(upload_key, 'total_files', 1)
            pi.hset(upload_key, 'files', 1)

        return self.handle_upload(temp_file, upload_id, upload_key, infos, filename,
                                  user, force_coll, total_size)

    def handle_upload(self, stream, upload_id, upload_key, infos, filename,
                      user, force_coll, total_size):

        logger.debug('Begin handle_upload() from: ' + filename + ' force_coll: ' + str(force_coll))

        num_recs = 0
        num_recs = len(infos)
        # first info is for collection, not recording
        if num_recs >= 2:
            num_recs -= 1

        logger.debug('Parsed {0} recordings, Buffer Size {1}'.format(num_recs, total_size))

        first_coll, rec_infos = self.process_upload(user, force_coll, infos, stream,
                                                    filename, total_size, num_recs)

        if not rec_infos:
            print('NO ARCHIVES!')
            #stream.close()
            return {'error_message': 'No Archive Data Found'}

        with redis_pipeline(self.manager.redis) as pi:
            pi.hset(upload_key, 'coll', first_coll['id'])
            pi.hset(upload_key, 'coll_title', first_coll['title'])
            pi.hset(upload_key, 'filename', filename)
            pi.expire(upload_key, self.upload_exp)

        self.launch_upload(self.run_upload,
                           upload_key,
                           filename,
                           stream,
                           user,
                           rec_infos,
                           total_size)

        return {'upload_id': upload_id,
                'user': user
               }

    def _get_upload_id(self):
        return base64.b32encode(os.urandom(5)).decode('utf-8')

    def launch_upload(self, func, *args):
        gevent.spawn(func, *args)

    def run_upload(self, upload_key, filename, stream, user, rec_infos, total_size):
        try:
            count = 0
            num_recs = len(rec_infos)
            last_end = 0

            for info in rec_infos:
                count += 1
                logger.debug('Id: {0}, Uploading Rec {1} of {2}'.format(upload_key, count, num_recs))

                if info['length'] > 0:
                    self.do_upload(upload_key,
                                   filename,
                                   stream,
                                   user,
                                   info['coll'],
                                   info['rec'],
                                   info['offset'],
                                   info['length'])
                else:
                    logger.debug('SKIP upload for zero-length recording')


                pages = info.get('pages')
                if pages is None:
                    pages = self.detect_pages(user, info['coll'], info['rec'])

                if pages:
                    self.manager.import_pages(user, info['coll'], info['rec'], pages)

                diff = info['offset'] - last_end
                last_end = info['offset'] + info['length']
                if diff > 0:
                    self._add_split_padding(diff, upload_key)

        except:
            import traceback
            traceback.print_exc()

        finally:
            # add remainder of file, assumed consumed/skipped, if any
            last_end = stream.tell()
            stream.close()

            if last_end < total_size:
                diff = total_size - last_end
                self._add_split_padding(diff, upload_key)

            with redis_pipeline(self.manager.redis) as pi:
                pi.hincrby(upload_key, 'files', -1)
                pi.hset(upload_key, 'done', 1)

    def _add_split_padding(self, diff, upload_key):
        self.manager.redis.hincrby(upload_key, 'size', diff * 2)

    def _har2warc_temp_file(self):
        return SpooledTemporaryFile(max_size=BLOCK_SIZE)

    def har2warc(self, filename, stream):
        out = self._har2warc_temp_file()
        writer = WARCWriter(out)

        buff_list = []
        while True:
            buff = stream.read()
            if not buff:
                break

            buff_list.append(buff.decode('utf-8'))

        #wrapper = TextIOWrapper(stream)
        try:
            rec_title = filename.rsplit('/', 1)[-1]
            har = json.loads(''.join(buff_list))
            HarParser(har, writer).parse(filename + '.warc.gz', rec_title)
        finally:
            stream.close()

        size = out.tell()
        out.seek(0)
        return out, size

    def is_public(self, collection):
        return collection.get('public', False)

    def process_upload(self, user, force_coll, infos, stream, filename, total_size, num_recs):
        stream.seek(0)

        count = 0

        first_coll = None

        collection = None
        recording = None

        if force_coll:
            collection = self.manager.get_collection(user, force_coll)

        rec_infos = []

        for info in infos:
            type = info.get('type')

            if type == 'collection':
                if not force_coll:
                    collection = self._get_existing_coll(user, info, filename)

                if not collection:
                    collection = info
                    if not collection.get('id'):
                        collection['id'] = self.sanitize_title(collection['title'])
                    actual_collection = self.manager.create_collection(user,
                                                   collection['id'],
                                                   collection['title'],
                                                   collection.get('desc', ''),
                                                   self.is_public(collection))

                    collection['id'] = actual_collection['id']
                    collection['title'] = actual_collection['title']

            elif type == 'recording':
                if not collection:
                    collection = self.default_collection(user, filename)

                recording = info
                recording['id'] = self.sanitize_title(recording['title'])
                actual_recording = self.manager.create_recording(user,
                                              collection['id'],
                                              recording['id'],
                                              recording['title'],
                                              collection['title'])

                recording['id'] = actual_recording['id']
                recording['title'] = actual_recording['title']

                count += 1
                #yield collection, recording

                logger.debug('Processing Upload Rec {0} of {1}'.format(count, num_recs))

                rec_infos.append({'coll': collection['id'],
                                  'rec': recording['id'],
                                  'offset': recording['offset'],
                                  'length': recording['length'],
                                  'pages': recording.get('pages', None),
                                 })

                self.manager.set_recording_timestamps(user,
                                                      collection['id'],
                                                      recording['id'],
                                                      recording.get('created_at'),
                                                      recording.get('updated_at'))

            if not first_coll:
                first_coll = collection

        return first_coll, rec_infos

    def _get_existing_coll(self, user, info, filename):
        return None

    def detect_pages(self, user, coll, rec):
        key = self.cdxj_key.format(user=user, coll=coll, rec=rec)

        pages = []

        #for member, score in self.manager.redis.zscan_iter(key):
        for member in self.manager.redis.zrange(key, 0, -1):
            cdxj = CDXObject(member.encode('utf-8'))

            if len(pages) < 500 and self.is_page(cdxj):
                pages.append(dict(url=cdxj['url'],
                                  title=cdxj['url'],
                                  timestamp=cdxj['timestamp']))

        return pages

    def is_page(self, cdxj):
        if cdxj['url'].endswith('/robots.txt'):
            return False

        if not cdxj['url'].startswith(('http://', 'https://')):
            return False

        status = cdxj.get('status', '-')

        if (cdxj['mime'] in ('text/html', 'text/plain')  and
            status in ('200', '-') and
            cdxj['digest'] != EMPTY_DIGEST):


            if status == '200':
                # check for very long query, greater than the rest of url -- probably not a page
                parts = cdxj['url'].split('?', 1)
                if len(parts) == 2 and len(parts[1]) > len(parts[0]):
                    return False

            return True

        return False

    def do_upload(self, upload_key, filename, stream, user, coll, rec, offset, length):
        stream.seek(offset)

        logger.debug('do_upload(): {0} offset: {1}: len: {2}'.format(rec, offset, length))

        stream = LimitReader(stream, length)
        headers = {'Content-Length': str(length)}

        upload_url = self.upload_path.format(record_host=self.record_host,
                                             user=user,
                                             coll=coll,
                                             rec=rec,
                                             upid=upload_key)

        r = requests.put(upload_url,
                         headers=headers,
                         data=stream)

    def default_collection(self, user, filename):
        collection = self.upload_collection

        desc = collection.get('desc', '').format(filename=filename)
        public = collection.get('public', False)

        collection['id'] = self.sanitize_title(collection['title'])
        actual_collection = self.manager.create_collection(user,
                                       collection['id'],
                                       collection['title'],
                                       desc,
                                       public)

        collection['id'] = actual_collection['id']
        collection['title'] = actual_collection['title']
        collection['type'] = 'collection'

        return collection

    def parse_uploaded(self, stream, expected_size):
        arciterator = ArchiveIterator(stream,
                                      no_record_parse=True,
                                      verify_http=True,
                                      block_size=BLOCK_SIZE)
        infos = []

        last_indexinfo = None
        indexinfo = None
        is_first = True

        for record in arciterator:
            warcinfo = None
            if record.rec_type == 'warcinfo':
                try:
                    warcinfo = self.parse_warcinfo(record)
                except Exception as e:
                    print('Error Parsing WARCINFO')
                    traceback.print_exc()

            arciterator.read_to_end(record)

            if last_indexinfo:
                last_indexinfo['offset'] = arciterator.member_info[0]
                last_indexinfo = None

            if warcinfo:
                self.add_index_info(infos, indexinfo, arciterator.member_info[0])

                indexinfo = warcinfo.get('json-metadata')
                indexinfo['offset'] = None

                if 'title' not in indexinfo:
                    indexinfo['title'] = 'Uploaded Recording'

                if 'type' not in indexinfo:
                    indexinfo['type'] = 'recording'

                last_indexinfo = indexinfo

            elif is_first:
                indexinfo = {'type': 'recording',
                             'title': 'Uploaded Recording',
                             'offset': 0,
                            }

            is_first = False

        if indexinfo:
            self.add_index_info(infos, indexinfo, stream.tell())

        # if anything left over, likely due to WARC error, consume remainder
        if stream.tell() < expected_size:
            while True:
                buff = stream.read(8192)
                if not buff:
                    break

        return infos

    def add_index_info(self, infos, indexinfo, curr_offset):
        if not indexinfo or indexinfo.get('offset') is None:
            return

        indexinfo['length'] = curr_offset - indexinfo['offset']

        infos.append(indexinfo)

    def parse_warcinfo(self, record):
        valid = False
        warcinfo = {}
        warcinfo_buff = record.raw_stream.read(record.length)
        warcinfo_buff = warcinfo_buff.decode('utf-8')
        for line in warcinfo_buff.rstrip().split('\n'):
            parts = line.split(':', 1)

            if parts[0] == 'json-metadata':
                warcinfo['json-metadata'] = json.loads(parts[1])
                valid = True
            else:
                warcinfo[parts[0]] = parts[1].strip()

        # ignore if no json-metadata or doesn't contain type of colleciton or recording
        return warcinfo if valid else None


# ============================================================================
class InplaceLoader(UploadController):
    def __init__(self, manager, indexer, upload_id):
        super(InplaceLoader, self).__init__(None, None, manager, manager.config)
        self.indexer = indexer
        self.upload_id = upload_id

    def _get_upload_id(self):
        return self.upload_id

    def init_routes(self):
        pass

    def is_public(self, collection):
        return True

    def multifile_upload(self, user, files):
        total_size = 0

        for filename in files:
            total_size += os.path.getsize(filename)

        upload_id = self._get_upload_id()

        upload_key = self.upload_key.format(user=user, upid=upload_id)

        with redis_pipeline(self.manager.redis) as pi:
            pi.hset(upload_key, 'size', 0)
            pi.hset(upload_key, 'total_size', total_size * 2)
            pi.hset(upload_key, 'total_files', len(files))
            pi.hset(upload_key, 'files', len(files))
            pi.expire(upload_key, 120)

        gevent.sleep(0)

        for filename in files:
            size = 0
            fh = None
            try:
                size = os.path.getsize(filename)
                fh = open(filename, 'rb')

                self.manager.redis.hset(upload_key, 'filename', filename)

                stream = SizeTrackingReader(fh, size, self.manager.redis, upload_key)

                if filename.endswith('.har'):
                    stream, expected_size = self.har2warc(filename, stream)
                    fh.close()
                    fh = stream
                    atexit.register(lambda: os.remove(stream.name))

                infos = self.parse_uploaded(stream, size)

                res = self.handle_upload(fh, upload_id, upload_key, infos, filename,
                                         user, False, size)

                assert('error_message' not in res)
            except Exception as e:
                print('ERROR PARSING: ' + filename)
                print(e)
                if fh:
                    rem = size - fh.tell()
                    if rem > 0:
                        self.manager.redis.hincrby(upload_key, 'size', rem)
                    self.manager.redis.hincrby(upload_key, 'files', -1)
                    fh.close()

    def do_upload(self, upload_key, filename, stream, user, coll, rec, offset, length):
        stream.seek(offset)

        if hasattr(stream, 'name'):
            filename = stream.name

        params = {'param.user': user,
                  'param.coll': coll,
                  'param.rec': rec,
                  'param.upid': upload_key,
                 }

        self.indexer.add_warc_file(filename, params)
        self.indexer.add_urls_to_index(stream, params, filename, length)

    def _add_split_padding(self, diff, upload_key):
        self.manager.redis.hincrby(upload_key, 'size', diff)

    def _har2warc_temp_file(self):
        return NamedTemporaryFile(suffix='.warc.gz', delete=False)

    def launch_upload(self, func, *args):
        func(*args)

    def _get_existing_coll(self, user, info, filename):
        if info.get('title') == 'Temporary Collection':
            info['title'] = 'Collection'
            if not info.get('desc'):
                info['desc'] = self.upload_collection.get('desc', '').format(filename=filename)
        else:
        # for now, force player collections to have id 'collection' for predictable paths
            info['id'] = 'collection'

        return None

