from tempfile import SpooledTemporaryFile, NamedTemporaryFile
from bottle import request

from warcio.archiveiterator import ArchiveIterator
from warcio.limitreader import LimitReader

from har2warc.har2warc import har2warc
import codecs

from warcio.warcwriter import BufferWARCWriter, WARCWriter
from warcio.timeutils import iso_date_to_datetime


from pywb.warcserver.index.cdxobject import CDXObject

import traceback
import json
import requests
import atexit

import base64
import os
import gevent
import redis

from webrecorder.utils import SizeTrackingReader, CacheingLimitReader
from webrecorder.utils import redis_pipeline, sanitize_title

import logging
logger = logging.getLogger(__name__)


BLOCK_SIZE = 16384 * 8
EMPTY_DIGEST = '3I42H3S6NNFQ2MSVX7XZKYAYSCX5QBYJ'


# ============================================================================
class ImportStatusChecker(object):
    """WARC upload status monitor.

    :cvar str UPLOAD_KEY: upload Redis key
    :cvar int UPLOAD_EXP: upload Redis entry TTL
    :ivar StrictRedis redis: Redis interface
    """
    UPLOAD_KEY = 'u:{user}:upl:{upid}'
    UPLOAD_EXP = 120

    def __init__(self, redis):
        """Initialize status monitor.

        :param StrictRedis redis: Redis interface
        """
        self.redis = redis

    def get_upload_status(self, user, upload_id):
        """Return WARC upload status.

        :param User user: user
        :param str upload_id: upload ID
        """
        upload_key = self.UPLOAD_KEY.format(user=user.name, upid=upload_id)

        props = self.redis.hgetall(upload_key)
        if not props:
            return {}

        props['user'] = user.name
        props['upload_id'] = upload_id

        total_size = props.get('total_size')
        if not total_size:
            return props

        self.redis.expire(upload_key, self.UPLOAD_EXP)
        props['total_size'] = int(total_size)
        props['size'] = int(props.get('size', 0))
        props['files'] = int(props['files'])
        props['total_files'] = int(props['total_files'])
        props['done'] = (props.get('done') == '1')

        if props.get('files') == 0:
            props['size'] = props['total_size']

        return props


# ============================================================================
class BaseImporter(ImportStatusChecker):
    """WARC importer base class.

    :ivar dict config: Webrecorder configuration
    :ivar wam_loader: n.s.
    :ivar str cdxj_key: CDX index file Redis key template
    :ivar str upload_path: upload URL template
    :ivar int upload_exp: upload status TTL
    :ivar str record_host: record host
    :ivar dict upload_coll_info: upload collection information
    :ivar int max_detect_pages: maximum number of detectable pages
    """
    def __init__(self, redis, config, wam_loader=None):
        """Initialize base class.

        :param StrictRedis redis: Redis interface
        :param dict config: Webrecorder configuration
        :param wam_loader: n.s.
        """
        super(BaseImporter, self).__init__(redis)
        self.config = config
        self.wam_loader = wam_loader

        self.cdxj_key = config['cdxj_key_templ']

        self.upload_path = config['url_templates']['upload']
        self.upload_exp = int(config['upload_status_expire'])

        self.record_host = os.environ['RECORD_HOST']

        self.upload_coll_info = config['upload_coll']

        self.detect_list_info = config['page_detect_list']

        self.max_detect_pages = config['max_detect_pages']

    def handle_upload(self, stream, upload_id, upload_key, infos, filename,
                      user, force_coll_name, total_size):
        """Operate WARC archive upload.

        :param stream: file object
        :param str upload_id: upload ID
        :param str upload_key: upload Redis key
        :param list infos: list of recordings
        :param str filename: WARC archive filename
        :param user User: user
        :param str force_coll_name: name of collection to upload into
        :param int total_size: size of WARC archive

        :returns: upload information
        :rtype: dict
        """

        logger.debug('Begin handle_upload() from: ' + filename + ' force_coll_name: ' + str(force_coll_name))

        num_recs = 0
        num_recs = len(infos)
        # first info is for collection, not recording
        if num_recs >= 2:
            num_recs -= 1

        logger.debug('Parsed {0} recordings, Buffer Size {1}'.format(num_recs, total_size))

        first_coll, rec_infos = self.process_upload(user, force_coll_name, infos, stream,
                                                    filename, total_size, num_recs)

        if not rec_infos:
            print('NO ARCHIVES!')
            #stream.close()
            return {'error': 'no_archive_data'}

        with redis_pipeline(self.redis) as pi:
            pi.hset(upload_key, 'coll', first_coll.name)
            pi.hset(upload_key, 'coll_title', first_coll.get_prop('title'))
            pi.hset(upload_key, 'filename', filename)
            pi.expire(upload_key, self.upload_exp)

        self.launch_upload(self.run_upload,
                           upload_key,
                           filename,
                           stream,
                           user,
                           rec_infos,
                           total_size,
                           first_coll)

        return {'upload_id': upload_id,
                'user': user.name
               }

    def _init_upload_status(self, user, total_size, num_files, filename=None, expire=None):
        """Initialize upload status.

        :param User user: user
        :param int total_size: size of WARC archive
        :param int num_files: n.s.
        :param filename: WARC archive filename
        :type: str or None
        :param expire: upload TTL
        :type: int or None

        :returns: upload ID and upload Redis key
        :rtype: str and str
        """
        upload_id = self._get_upload_id()

        upload_key = self.UPLOAD_KEY.format(user=user.name, upid=upload_id)

        with redis_pipeline(self.redis) as pi:
            pi.hset(upload_key, 'size', 0)
            pi.hset(upload_key, 'total_size', total_size * 2)
            pi.hset(upload_key, 'total_files', num_files)
            pi.hset(upload_key, 'files', num_files)

            if filename:
                pi.hset(upload_key, 'filename', filename)

            if expire:
                pi.expire(upload_key, expire)

        return upload_id, upload_key

    def run_upload(self, upload_key, filename, stream, user, rec_infos, total_size, first_coll):
        """Upload WARC archive.

        :param str upload_key: upload Redis key
        :param str filename: WARC archive filename
        :param stream: file object
        :param User user: user
        :param list rec_infos: list of recordings
        :param int total_size: size of WARC archive
        :param Collection first_coll: collection
        """
        try:
            count = 0
            num_recs = len(rec_infos)
            last_end = 0
            page_id_map = {}

            for info in rec_infos:
                count += 1
                logger.debug('Id: {0}, Uploading Rec {1} of {2}'.format(upload_key, count, num_recs))

                if info['length'] > 0:
                    self.do_upload(upload_key,
                                   filename,
                                   stream,
                                   user.name,
                                   info['coll'],
                                   info['rec'],
                                   info['offset'],
                                   info['length'])
                else:
                    logger.debug('SKIP upload for zero-length recording')


                self.process_pages(info, page_id_map)

                diff = info['offset'] - last_end
                last_end = info['offset'] + info['length']
                if diff > 0:
                    self._add_split_padding(diff, upload_key)

                recording = info['recording']
                recording.set_date_prop('created_at', info)
                recording.set_date_prop('recorded_at', info)
                recording.set_date_prop('updated_at', info)

            self.import_lists(first_coll, page_id_map)

            self.postprocess_coll(first_coll)

            first_coll.set_date_prop('created_at', first_coll.data, '_created_at')
            first_coll.set_date_prop('updated_at', first_coll.data, '_updated_at')

        except:
            traceback.print_exc()

        finally:
            # add remainder of file, assumed consumed/skipped, if any
            last_end = stream.tell()
            stream.close()

            if last_end < total_size:
                diff = total_size - last_end
                self._add_split_padding(diff, upload_key)

            with redis_pipeline(self.redis) as pi:
                pi.hincrby(upload_key, 'files', -1)
                pi.hset(upload_key, 'done', 1)

            if first_coll.is_external():
                first_coll.sync_coll_index(exists=False, do_async=False)
                first_coll.set_external_remove_on_expire()

    def process_pages(self, info, page_id_map):
        pages = info.get('pages')

        # detect pages if none
        detected = False
        if pages is None:
            pages = self.detect_pages(info['coll'], info['rec'])
            detected = True

        # if no pages, nothing more to do
        if not pages:
            return

        # import pages, set id map of old pages to new ones, if any
        id_map = info['collection'].import_pages(pages, info['recording'])

        if id_map:
            page_id_map.update(id_map)

        # if pages are detected, also created an automatic page detected list
        if detected:
            blist = info['collection'].create_bookmark_list(self.detect_list_info)

            for page in pages:
                page['page_id'] = page['id']
                bookmark = blist.create_bookmark(page, incr_stats=False)

    def har2warc(self, filename, stream):
        """Convert HTTP Archive format file to WARC archive.

        :param str filename: name of HAR file
        :param stream: file object (input)

        :returns: file object (output) and size of WARC archive
        :rtype: file object and int
        """
        out = self._har2warc_temp_file(filename)

        stream = codecs.getreader('utf-8')(stream)

        rec_title = os.path.basename(filename)

        har2warc(stream, out, filename + '.warc', rec_title)

        #writer = WARCWriter(out)
        #HarParser(stream, writer).parse(filename + '.warc', rec_title)

        size = out.tell()
        out.seek(0)
        return out, size

    def process_upload(self, user, force_coll_name, infos, stream, filename, total_size, num_recs):
        """Process WARC archive.

        :param User user: user
        :param str force_coll_name: name of collection to upload into
        :param list infos: list of recordings (indices)
        :param stream: file object
        :param str filename: WARC archive filename
        :param int total_size: WARC archive size
        :param int num_recs: number of recordings

        :returns: collection and recordings
        :rtype: Collection and list
        """
        stream.seek(0)

        count = 0

        first_coll = None

        collection = None
        recording = None

        if force_coll_name:
            collection = user.get_collection_by_name(force_coll_name)

        rec_infos = []

        lists = None

        for info in infos:
            type = info.get('type')

            if type == 'collection':
                if not collection:
                    collection = self.make_collection(user, filename, info)
                lists = info.get('lists')


            elif type == 'recording':
                if not collection:
                    collection = self.make_collection(user, filename, self.upload_coll_info, info)

                desc = info.get('desc', '')

                # if title was auto-generated for compatibility on export,
                # set title to blank
                if info.get('auto_title'):
                    title = ''
                else:
                    title = info.get('title', '')

                recording = collection.create_recording(title=title,
                                                        desc=desc,
                                                        rec_type=info.get('rec_type'),
                                                        ra_list=info.get('ra'))

                info['id'] = recording.my_id

                count += 1
                #yield collection, recording

                logger.debug('Processing Upload Rec {0} of {1}'.format(count, num_recs))

                rec_infos.append({'coll': collection.my_id,
                                  'rec': recording.my_id,
                                  'offset': info['offset'],
                                  'length': info['length'],
                                  'pages': info.get('pages', None),
                                  'collection': collection,
                                  'recording': recording,
                                  'created_at': info.get('created_at'),
                                  'updated_at': info.get('updated_at'),
                                  'recorded_at': info.get('recorded_at', info.get('updated_at')),
                                 })

            if not first_coll:
                first_coll = collection


        if lists:
            collection.data['_lists'] = lists

        return first_coll, rec_infos

    def import_lists(self, collection, page_id_map):
        """Import lists of bookmarks.

        :param Collection collection: collection
        :param page_id_map: n.s.
        """
        lists = collection.data.get('_lists')

        if not lists:
            return

        for list_data in lists:
            bookmarks = list_data.pop('bookmarks', [])
            self.process_list_data(list_data)
            blist = collection.create_bookmark_list(list_data)
            for bookmark_data in bookmarks:
                page_id = bookmark_data.get('page_id')
                if page_id:
                    bookmark_data['page_id'] = page_id_map.get(page_id)
                bookmark = blist.create_bookmark(bookmark_data, incr_stats=False)

    def detect_pages(self, coll, rec):
        """Find pages in recording.

        :param str coll: collection ID
        :param str rec: recording ID

        :returns: pages
        :rtype: list
        """
        key = self.cdxj_key.format(coll=coll, rec=rec)

        pages = []

        #for member, score in self.redis.zscan_iter(key):
        for member in self.redis.zrange(key, 0, -1):
            cdxj = CDXObject(member.encode('utf-8'))

            if ((not self.max_detect_pages or len(pages) < self.max_detect_pages)
                and self.is_page(cdxj)):
                pages.append(dict(url=cdxj['url'],
                                  title=cdxj['url'],
                                  timestamp=cdxj['timestamp']))

        return pages

    def is_page(self, cdxj):
        """Return whether CDX/CDXJ index line is a page.

        :param CDXObject cdxj: CDX/CDXJ index line

        :returns: whether CDX/CDXJ index line is a page
        :rtype: bool
        """
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

    def parse_uploaded(self, stream, expected_size):
        """Parse WARC archive.

        :param stream: file object
        :param int expected_size: expected WARC archive size

        :returns: list of recordings (indices)
        :rtype: list
        """
        arciterator = ArchiveIterator(stream,
                                      no_record_parse=True,
                                      verify_http=True,
                                      block_size=BLOCK_SIZE)
        infos = []

        last_indexinfo = None
        indexinfo = None
        is_first = True
        remote_archives = None

        for record in arciterator:
            warcinfo = None
            if record.rec_type == 'warcinfo':
                try:
                    warcinfo = self.parse_warcinfo(record)
                except Exception as e:
                    print('Error Parsing WARCINFO')
                    traceback.print_exc()

            elif remote_archives is not None:
                source_uri = record.rec_headers.get('WARC-Source-URI')
                if source_uri:
                    if self.wam_loader:
                        res = self.wam_loader.find_archive_for_url(source_uri)
                        if res:
                            remote_archives.add(res[2])

            arciterator.read_to_end(record)

            if last_indexinfo:
                last_indexinfo['offset'] = arciterator.member_info[0]
                last_indexinfo = None

            if warcinfo and 'json-metadata' in warcinfo:
                self.add_index_info(infos, indexinfo, arciterator.member_info[0])

                indexinfo = warcinfo.get('json-metadata')
                indexinfo['offset'] = None

                if 'title' not in indexinfo:
                    indexinfo['title'] = 'Uploaded Recording'

                if 'type' not in indexinfo:
                    indexinfo['type'] = 'recording'

                indexinfo['ra'] = set()
                remote_archives = indexinfo['ra']

                last_indexinfo = indexinfo

            elif is_first:
                indexinfo = {'type': 'recording',
                             'title': 'Uploaded Recording',
                             'offset': 0,
                            }

            if is_first and warcinfo and 'software' in warcinfo:
                indexinfo['warcinfo:software'] = warcinfo['software']
                indexinfo['warcinfo:datetime'] = record.rec_headers.get('WARC-Date')

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
        """Add index to list of recordings.

        :param list infos: list of recordings (indices)
        :param dict indexinfo: information about index
        :param int curr_offset: current offset to start of stream
        """
        if not indexinfo or indexinfo.get('offset') is None:
            return

        indexinfo['length'] = curr_offset - indexinfo['offset']

        infos.append(indexinfo)

    def parse_warcinfo(self, record):
        """Parse WARC information.

        :param record: WARC information

        :returns: WARC information or None
        :rtype: dict or None
        """
        valid = False
        warcinfo = {}
        warcinfo_buff = record.raw_stream.read(record.length)
        warcinfo_buff = warcinfo_buff.decode('utf-8')
        for line in warcinfo_buff.rstrip().split('\n'):
            parts = line.split(':', 1)

            if parts[0] == 'json-metadata':
                warcinfo['json-metadata'] = json.loads(parts[1])
                valid = True
            elif len(parts) == 2:
                warcinfo[parts[0]] = parts[1].strip()

        # ignore if no json-metadata or doesn't contain type of colleciton or recording
        # return warcinfo if valid else None
        return warcinfo

    def prepare_coll_desc(self, filename, info, rec_info=None):
        params = dict(filename=filename)

        if not rec_info and 'warcinfo:software' in info:
            rec_info = info

        if rec_info and 'warcinfo:software' in rec_info:
            params['software'] = rec_info['warcinfo:software']
            params['datetime'] = self.to_gmt_string(rec_info['warcinfo:datetime'])
        else:
            params['software'] = 'unknown'
            params['datetime'] = 'unknown'

        info['desc'] = info.get('desc', '').format(**params)
        return params

    @classmethod
    def to_gmt_string(cls, dt):
        return iso_date_to_datetime(dt).strftime("%Y-%m-%d %H:%M:%S") + ' GMT'

    def do_upload(self, upload_key, filename, stream, user, coll, rec, offset, length):
        raise NotImplemented()

    def launch_upload(self, func, *args):
        raise NotImplemented()

    def _get_upload_id(self):
        raise NotImplemented()

    def is_public(self, info):
        raise NotImplemented()

    def _add_split_padding(self, diff, upload_key):
        raise NotImplemented()

    def _har2warc_temp_file(self, filename):
        raise NotImplemented()

    def make_collection(self, user, filename, info, rec_info=None):
        raise NotImplemented()


# ============================================================================
class UploadImporter(BaseImporter):
    """WARC archive importer (upload)."""
    def upload_file(self, user, stream, expected_size, filename, force_coll_name=''):
        """Upload WARC archive.

        :param User user: user
        :param stream: file object
        :param int expected_size: expected WARC archive size
        :param str filename: WARC archive filename
        :param str force_coll_name: name of collection to upload into

        :returns: upload information
        :rtype: dict
        """
        temp_file = None
        logger.debug('Upload Begin')

        logger.debug('Expected Size: ' + str(expected_size))

        #is_anon = False

        size_rem = user.get_size_remaining()

        logger.debug('User Size Rem: ' + str(size_rem))

        if size_rem < expected_size:
            return {'error': 'out_of_space'}

        if force_coll_name and not user.has_collection(force_coll_name):
            #if is_anon:
            #    user.create_collection(force_coll, 'Temporary Collection')

            #else:
            #status = 'Collection {0} not found'.format(force_coll_name)
            return {'error': 'no_such_collection'}

        temp_file = SpooledTemporaryFile(max_size=BLOCK_SIZE)

        stream = CacheingLimitReader(stream, expected_size, temp_file)

        if filename.endswith('.har'):
            stream, expected_size = self.har2warc(filename, stream)
            temp_file.close()
            temp_file = stream

        infos = self.parse_uploaded(stream, expected_size)

        total_size = temp_file.tell()
        if total_size != expected_size:
            return {'error': 'incomplete_upload', 'expected': expected_size, 'actual': total_size}

        upload_id, upload_key = self._init_upload_status(user, total_size, 1, filename=filename)

        return self.handle_upload(temp_file, upload_id, upload_key, infos, filename,
                                  user, force_coll_name, total_size)

    def do_upload(self, upload_key, filename, stream, user, coll, rec, offset, length):
        """Send PUT request to upload recording.

        :param str upload_key: upload Redis key
        :param str filename: WARC archive filename
        :param stream: file object
        :param User user: user
        :param str coll: collection ID
        :param str rec: record ID
        :param int offset: offset to start of stream
        :param int length: length of recording
        """
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

    def _get_upload_id(self):
        """Return new upload ID.

        :returns: new upload ID
        :rtype: str
        """
        return base64.b32encode(os.urandom(5)).decode('utf-8')

    def postprocess_coll(self, collection):
        pass

    def process_list_data(self, list_data):
        pass

    def _add_split_padding(self, diff, upload_key):
        """Update size of upload by size of padding.

        :param int diff: size of padding
        :param str upload_key: upload Redis key
        """
        self.redis.hincrby(upload_key, 'size', diff * 2)

    def _har2warc_temp_file(self, filename):
        """Return temporary file.

        :returns: temporary file
        :rtype: SpooledTemporaryFile
        """
        return SpooledTemporaryFile(max_size=BLOCK_SIZE)

    def launch_upload(self, func, *args):
        """Spawn upload process.

        :param function func: upload function
        """
        gevent.spawn(func, *args)

    def make_collection(self, user, filename, info, rec_info=None):
        """Create collection.

        :param User user: user
        :param str filename: WARC archive filename
        :param dict info: collection information
        :param rec_info: recording information
        :type: dict or None

        :returns: collection
        :rtype: Collection
        """
        self.prepare_coll_desc(filename, info, rec_info)
        public = info.get('public', False)
        public_index = info.get('public_index', False)

        info['id'] = sanitize_title(info['title'])
        collection = user.create_collection(info['id'],
                                       title=info['title'],
                                       desc=info['desc'],
                                       public=public,
                                       public_index=public_index,
                                       allow_dupe=True)

        info['id'] = collection.name
        info['type'] = 'collection'

        collection.data['_updated_at'] = info.get('updated_at')
        collection.data['_created_at'] = info.get('created_at')

        return collection


# ============================================================================
class InplaceImporter(BaseImporter):
    """WARC archive importer (in-place).

    :ivar indexer: n.s.
    :ivar str upload_id: upload ID
    :ivar the_collection: collection to import WARC archive into
    :type: Collection or None
    :ivar str cache_dir: cache directory
    :ivar str wr_temp_coll: temporary collection
    """
    def __init__(self, redis, config, user, indexer, upload_id, create_coll=True, cache_dir=None):
        wam_loader = indexer.wam_loader if indexer else None
        super(InplaceImporter, self).__init__(redis, config, wam_loader)
        self.indexer = indexer
        self.upload_id = upload_id
        self.cache_dir = cache_dir

        self.wr_temp_coll = config['wr_temp_coll']

        if not create_coll:
            self.the_collection = None
            return

        self.the_collection = user.create_collection(self.upload_coll_info['id'],
                                                     title=self.upload_coll_info['title'],
                                                     desc=self.upload_coll_info['desc'],
                                                     public=self.upload_coll_info['public'])

    def multifile_upload(self, user, files):
        """Import multiple files.

        :param User user: user
        :param list files: list of filenames
        """
        total_size = 0

        for filename in files:
            total_size += os.path.getsize(filename)

        upload_id, upload_key = self._init_upload_status(user, total_size,
                                                         num_files=len(files),
                                                         expire=self.upload_exp)

        gevent.sleep(0)

        for filename in files:
            size = 0
            fh = None
            try:
                size = os.path.getsize(filename)
                fh = open(filename, 'rb')

                self.redis.hset(upload_key, 'filename', filename)

                stream = SizeTrackingReader(fh, size, self.redis, upload_key)

                if filename.endswith('.har'):
                    stream, expected_size = self.har2warc(filename, stream)
                    fh.close()
                    fh = stream

                infos = self.parse_uploaded(stream, size)

                res = self.handle_upload(fh, upload_id, upload_key, infos, filename,
                                         user, False, size)

                assert('error' not in res)
            except Exception as e:
                traceback.print_exc()
                print('ERROR PARSING: ' + filename)
                print(e)
                if fh:
                    rem = size - fh.tell()
                    if rem > 0:
                        self.redis.hincrby(upload_key, 'size', rem)
                    self.redis.hincrby(upload_key, 'files', -1)
                    fh.close()

    def do_upload(self, upload_key, filename, stream, user, coll, rec, offset, length):
        """Upload recording.

        :param str upload_key: upload Redis key
        :param str filename: filename
        :param stream: file object
        :param User user: user
        :param str coll: collection ID
        :param str rec: recording ID
        :param int offset: offset to start of stream
        :param int length: length of recording
        """
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

    def _get_upload_id(self):
        """Return upload ID."""
        return self.upload_id

    def postprocess_coll(self, collection):
        if collection.num_lists() == 0:
            collection.set_bool_prop('public_index', True)

    def process_list_data(self, list_data):
        """Set list to public.

        :param dict list_data: list information
        """
        if list_data:
            list_data['public'] = True

    def _add_split_padding(self, diff, upload_key):
        """Update import size by size of padding.

        :param int diff: size of padding
        :param str upload_key: upload Redis key
        """
        self.redis.hincrby(upload_key, 'size', diff)

    def _har2warc_temp_file(self, filename):
        """Return temporay file.

        :returns: temporary file
        :rtype: NamedTemporaryFile
        """
        if not self.cache_dir:
            out = NamedTemporaryFile(suffix='.warc.gz', delete=False)
            out_name = out.name
            atexit.register(lambda: os.remove(out_name))
        else:
            basename = os.path.basename(filename) + '.warc'
            out = open(os.path.join(self.cache_dir, basename), 'w+b')

        return out

    def launch_upload(self, func, *args):
        """Call upload function.

        :param function func: upload function
        """
        func(*args)

    def make_collection(self, user, filename, info, rec_info=None):
        """Create collection.

        :param User user: user
        :param str filename: filename
        :param dict info: collection information
        :param rec_info: recording information
        :type: dict or None

        :returns: collection
        :rtype: Collection
        """
        params = self.prepare_coll_desc(filename, info, rec_info)

        if info.get('title') == 'Temporary Collection':
            info['title'] = self.wr_temp_coll['title']
            if not info['desc']:
                info['desc'] = self.wr_temp_coll['desc'].format(**params)

        self.the_collection.set_prop('title', info['title'], update_ts=False)
        self.the_collection.set_prop('desc', info['desc'], update_ts=False)

        #if not info.get('public'):
        #    self.the_collection.set_bool_prop('public_index', True)
        # for now, have index be always public
        self.the_collection.set_bool_prop('public_index', True)
        self.the_collection.set_bool_prop('public', True)

        return self.the_collection

