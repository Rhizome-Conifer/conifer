from webrecorder.basecontroller import BaseController
from tempfile import SpooledTemporaryFile
from bottle import request

from pywb.warc.archiveiterator import ArchiveIterator
from pywb.utils.loaders import LimitReader
from pywb.cdx.cdxobject import CDXObject

import traceback
import json
import requests


BLOCK_SIZE = 16384
EMPTY_DIGEST = '3I42H3S6NNFQ2MSVX7XZKYAYSCX5QBYJ'

# ============================================================================
class UploadController(BaseController):
    def __init__(self, app, jinja_env, manager, config):
        super(UploadController, self).__init__(app, jinja_env, manager, config)
        self.upload_path = config['url_templates']['upload']
        self.cdxj_key = config['cdxj_key_templ']

    def init_routes(self):
        @self.app.post('/_upload')
        def upload_file():
            stream = None
            upload = None

            try:
                upload = request.files.get('upload-file')

                if not upload:
                    return {'error_message': 'No File Specified'}

                curr_user = self.manager.get_curr_user()

                if curr_user:
                    user = curr_user
                    force_coll = request.forms.getunicode('force-coll')
                    is_anon = False
                else:
                    return {'error_message': 'Sorry, uploads only available for logged-in users'}

                    #user = self.manager.get_anon_user()
                    #force_coll = 'temp'
                    #is_anon = True

                print('Force Coll', force_coll)

                if force_coll and not self.manager.has_collection(user, force_coll):
                    if is_anon:
                        self.manager.create_collection(user, force_coll, 'Temporary Collection')

                    else:
                        status = 'Collection {0} not found'.format(force_coll)
                        return {'error_message': status}


                stream = SpooledTemporaryFile(max_size=BLOCK_SIZE)

                upload.save(stream)

                size_rem = self.manager.get_size_remaining(user)

                if size_rem < stream.tell():
                    return {'error_message': 'Sorry, not enough space to upload this file'}

                filename = upload.filename

                new_coll, error_message = self.handle_upload(stream, filename, user, force_coll)

                if new_coll:
                    msg = 'Uploaded file <b>{1}</b> into collection <b>{0}</b>'.format(new_coll['title'], filename)

                    self.flash_message(msg, 'success')

                    return {'uploaded': 'true',
                            'user': user,
                            'coll': new_coll['id']}

                else:
                    print(error_message)
                    return {'error_message': error_message}

            except Exception as e:
                traceback.print_exc()
                return {'error_message': str(e)}

            finally:
                if upload:
                    upload.file.close()

                if stream:
                    stream.close()


    def handle_upload(self, stream, filename, user, force_coll):
        stream.seek(0)
        total = 0

        try:
            infos = self.parse_uploaded(stream)
            total = len(infos)
            #status = 'Processing {0} recordings'.format(total)
        except:
            traceback.print_exc()
            return (None, 'Invalid Web Archive (Parsing Error)')

        stream.seek(0)

        count = 0

        first_coll = None

        try:
            for coll, rec in self.process_upload(user, force_coll, infos, stream, filename):
                count += 1
                #status = 'Processing {0} of {1}'.format(count, total)
                if not first_coll:
                    first_coll = coll

        except:
            traceback.print_exc()
            return (None, 'Processing Error')

        return (first_coll, None)

    def process_upload(self, user, force_coll, infos, stream, filename):
        collection = None
        recording = None

        if force_coll:
            collection = self.manager.get_collection(user, force_coll)

        for info in infos:
            type = info.get('type')

            if type == 'collection' and not force_coll:
                collection = info
                collection['id'] = self.sanitize_title(collection['title'])
                actual_collection = self.manager.create_collection(user,
                                               collection['id'],
                                               collection['title'],
                                               collection.get('desc', ''),
                                               collection.get('public', False))

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

                yield collection, recording

                self.do_upload(stream,
                               user,
                               collection['id'],
                               recording['id'],
                               recording['offset'],
                               recording['length'])

                self.manager.set_recording_timestamps(user,
                                                      collection['id'],
                                                      recording['id'],
                                                      recording.get('created_at'),
                                                      recording.get('updated_at'))

                pages = recording.get('pages')
                if pages is None:
                    pages = self.detect_pages(user, collection['id'], recording['id'])

                if pages:
                    self.manager.import_pages(user, collection['id'], recording['id'], pages)

    def detect_pages(self, user, coll, rec):
        key = self.cdxj_key.format(user=user, coll=coll, rec=rec)

        pages = []

        for member, score in self.manager.redis.zscan_iter(key):
            cdxj = CDXObject(member)

            if len(pages) < 500 and self.is_page(cdxj):
                pages.append(dict(url=cdxj['url'],
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

    def do_upload(self, stream, user, coll, rec, offset, length):
        stream.seek(offset)

        stream = LimitReader(stream, length)
        headers = {'Content-Length': str(length)}

        upload_url = self.upload_path.format(record_host=self.record_host,
                                             user=user,
                                             coll=coll,
                                             rec=rec)

        r = requests.put(upload_url,
                         headers=headers,
                         data=stream)

    def default_collection(self, user, filename):
        desc = 'This collection was automatically created from upload of *{0}*'.format(filename)
        collection = {'type': 'collection',
                      'title': 'Upload Collection',
                      'desc': desc,
                     }

        collection['id'] = self.sanitize_title(collection['title'])
        actual_collection = self.manager.create_collection(user,
                                       collection['id'],
                                       collection['title'],
                                       collection.get('desc', ''),
                                       collection.get('public', False))

        collection['id'] = actual_collection['id']
        collection['title'] = actual_collection['title']

        return collection

    def parse_uploaded(self, stream):
        arciterator = ArchiveIterator(stream, no_record_parse=True, verify_http=True)
        infos = []

        last_indexinfo = None
        indexinfo = None
        is_first = True

        for record in arciterator(BLOCK_SIZE):
            warcinfo = None
            if record.rec_type == 'warcinfo':
                try:
                    warcinfo = self.parse_warcinfo(record)
                except Exception as e:
                    print('Error Parsing WARCINFO')
                    traceback.print_exc()

            arciterator.read_to_end(record)

            if warcinfo:
                new_offset = self.add_index_info(infos, indexinfo, arciterator)

                indexinfo = warcinfo.get('json-metadata')

                indexinfo['offset'] = new_offset
                if 'title' not in indexinfo:
                    indexinfo['title'] = 'Uploaded Recording'

                if 'type' not in indexinfo:
                    indexinfo['type'] = 'recording'

            elif is_first:
                indexinfo = {'type': 'recording',
                             'title': 'Uploaded Recording',
                             'offset': 0,
                            }

            is_first = False

        if indexinfo:
            self.add_index_info(infos, indexinfo, arciterator)

        return infos

    def add_index_info(self, infos, indexinfo, arciterator):
        new_offset = arciterator.member_info[0] + arciterator.member_info[1]
        if indexinfo:
            indexinfo['length'] = new_offset - indexinfo['offset']
            infos.append(indexinfo)

        return new_offset

    def parse_warcinfo(self, record):
        valid = False
        warcinfo = {}
        warcinfo_buff = record.stream.read(record.length)
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

