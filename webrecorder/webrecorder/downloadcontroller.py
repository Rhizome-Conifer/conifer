from pywb.utils.timeutils import timestamp_now
from pywb.utils.loaders import BlockLoader

from webagg.utils import StreamIter, chunk_encode_iter
from recorder.warcwriter import SimpleTempWARCWriter

from webrecorder.basecontroller import BaseController
from webrecorder import __version__

from bottle import response
from six.moves.urllib.parse import quote
from six import iteritems
from collections import OrderedDict
import json


# ============================================================================
class DownloadController(BaseController):
    COPY_FIELDS = ['title', 'desc', 'size', 'updated_at', 'created_at']

    def __init__(self, app, jinja_env, manager, config):
        super(DownloadController, self).__init__(app, jinja_env, manager, config)
        self.paths = config['url_templates']
        self.download_filename = config['download_paths']['filename']
        self.warc_key_templ = config['warc_key_templ']

    def init_routes(self):
        @self.app.get('/<user>/<coll>/<rec>/$download')
        def logged_in_download_rec_warc(user, coll, rec):
            self.redir_host()

            return self.handle_download(user, coll, rec)

        @self.app.get('/<user>/<coll>/$download')
        def logged_in_download_coll_warc(user, coll):
            self.redir_host()

            return self.handle_download(user, coll, '*')

    def create_warcinfo(self, creator, title, metadata, source, filename):
        for name, value in iteritems(source):
            if name in self.COPY_FIELDS:
                metadata[name] = value

        info = OrderedDict([
                ('software', 'Webrecorder Platform v' + __version__),
                ('format', 'WARC File Format 1.0'),
                ('creator', creator),
                ('isPartOf', title),
                ('json-metadata', json.dumps(metadata)),
               ])

        wi_writer = SimpleTempWARCWriter()
        wi_writer.write_record(wi_writer.create_warcinfo_record(filename, info))
        return wi_writer.get_buffer()

    def create_coll_warcinfo(self, user, collection, filename=''):
        metadata = {}
        metadata['type'] = 'collection'

        title = quote(collection['title'])
        return self.create_warcinfo(user, title, metadata, collection, filename)

    def create_rec_warcinfo(self, user, collection, recording, filename=''):
        metadata = {}
        metadata['pages'] = self.manager.list_pages(user,
                                                    collection['id'],
                                                    recording['id'])
        metadata['type'] = 'recording'

        title = quote(collection['title']) + '/' + quote(recording['title'])
        return self.create_warcinfo(user, title, metadata, recording, filename)

    def handle_download(self, user, coll, rec):
        collection = self.manager.get_collection(user, coll, rec)
        if not collection:
            self._raise_error(404, 'Collection not found',
                              id=coll)

        now = timestamp_now()

        name = collection['id']
        if rec != '*':
            rec_list = rec.split(',')
            if len(rec_list) == 1:
                name = rec
            else:
                name += '-' + rec
        else:
            rec_list = None

        filename = self.download_filename.format(title=quote(name),
                                                 timestamp=now)
        loader = BlockLoader()

        size = 0
        infos = []

        warcinfo = self.create_coll_warcinfo(user, collection, filename)
        size += len(warcinfo)
        infos.append(warcinfo)

        for recording in collection['recordings']:
            if rec_list and recording['id'] not in rec_list:
                continue

            warcinfo = self.create_rec_warcinfo(user,
                                                collection,
                                                recording,
                                                filename)

            size += len(warcinfo)
            size += recording['size']
            infos.append(warcinfo)

        def read_all():
            yield infos[0]

            for recording, warcinfo in zip(collection['recordings'], infos[1:]):
                if rec_list and recording['id'] not in rec_list:
                    continue

                yield warcinfo

                for warc_path in self._iter_all_warcs(user, coll, recording['id']):
                    try:
                        fh = loader.load(warc_path)
                    except:
                        print('Skipping invalid ' + warc_path)
                        continue

                    for chunk in StreamIter(fh):
                        yield chunk

        response.headers['Content-Type'] = 'application/octet-stream'
        response.headers['Content-Disposition'] = "attachment; filename*=UTF-8''" + filename

        response.headers['Content-Type'] = 'application/octet-stream'
        #response.headers['Content-Length'] = size

        response.headers['Transfer-Encoding'] = 'chunked'
        #resp = chunk_encode_iter(resp)

        return read_all()

    def _iter_all_warcs(self, user, coll, rec):
        warc_key = self.warc_key_templ.format(user=user, coll=coll, rec=rec)
        allwarcs = self.manager.redis.hgetall(warc_key)

        for n, v in iteritems(allwarcs):
            #n = n.decode('utf-8')
            yield v.decode('utf-8')
