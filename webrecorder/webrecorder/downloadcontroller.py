from warcio.timeutils import timestamp_now
from warcio.warcwriter import BufferWARCWriter

from pywb.utils.loaders import BlockLoader
from pywb.utils.io import StreamIter, chunk_encode_iter

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
        self.index_file_key = config['info_index_key']

        self.download_chunk_encoded = config['download_chunk_encoded']

    def init_routes(self):
        @self.app.get('/<user>/<coll>/<rec>/$download')
        def logged_in_download_rec_warc(user, coll, rec):
            self.redir_host()

            return self.handle_download(user, coll, rec)

        @self.app.get('/<user>/<coll>/$download')
        def logged_in_download_coll_warc(user, coll):
            self.redir_host()

            try:
                return self.handle_download(user, coll, '*')
            except:
                import traceback
                traceback.print_exc()

    def create_warcinfo(self, creator, title, metadata, source, filename):
        for name, value in iteritems(source.serialize()):
            if name in self.COPY_FIELDS:
                metadata[name] = value

        info = OrderedDict([
                ('software', 'Webrecorder Platform v' + __version__),
                ('format', 'WARC File Format 1.0'),
                ('creator', creator),
                ('isPartOf', title),
                ('json-metadata', json.dumps(metadata)),
               ])

        wi_writer = BufferWARCWriter()
        wi_writer.write_record(wi_writer.create_warcinfo_record(filename, info))
        return wi_writer.get_contents()

    def create_coll_warcinfo(self, user, collection, filename=''):
        metadata = {}
        metadata['type'] = 'collection'

        title = quote(collection.get_prop('title'))
        return self.create_warcinfo(user, title, metadata, collection, filename)

    def create_rec_warcinfo(self, user, collection, recording, filename=''):
        metadata = {}
        metadata['pages'] = recording.list_pages()
        metadata['type'] = 'recording'
        rec_type = recording.get_prop('rec_type')
        if rec_type:
            metadata['rec_type'] = rec_type

        title = quote(collection.get_prop('title')) + '/' + quote(recording.get_prop('title'))
        return self.create_warcinfo(user, title, metadata, recording, filename)

    def handle_download(self, user, coll_name, recs):
        user, collection = self.access.get_user_coll(user, coll_name)

        if not collection:
            self._raise_error(404, 'Collection not found',
                              id=coll_name)

        self.access.assert_can_write_coll(collection)

        #collection['uid'] = coll
        collection.load()

        now = timestamp_now()

        name = coll_name
        if recs != '*':
            rec_list = recs.split(',')
            if len(rec_list) == 1:
                name = recs
            else:
                name += '-' + recs
        else:
            rec_list = None

        filename = self.download_filename.format(title=quote(name),
                                                 timestamp=now)
        loader = BlockLoader()

        coll_info = self.create_coll_warcinfo(user, collection, filename)

        def iter_infos():
            for recording in collection.get_recordings(load=True):
                if rec_list and recording.name not in rec_list:
                    continue

                warcinfo = self.create_rec_warcinfo(user,
                                                    collection,
                                                    recording,
                                                    filename)

                size = len(warcinfo)
                size += recording.size
                yield recording, warcinfo, size

        def read_all(infos):
            yield coll_info

            for recording, warcinfo, _ in infos:
                yield warcinfo

                for n, warc_path in recording.iter_all_files():
                    try:
                        fh = loader.load(warc_path)
                    except:
                        print('Skipping invalid ' + warc_path)
                        continue

                    for chunk in StreamIter(fh):
                        yield chunk

        response.headers['Content-Type'] = 'application/octet-stream'
        response.headers['Content-Disposition'] = "attachment; filename*=UTF-8''" + filename

        # if not transfer-encoding, store infos and calculate total size
        if not self.download_chunk_encoded:
            size = len(coll_info)
            infos = list(iter_infos())
            size += sum(size for r, i, size in infos)

            response.headers['Content-Length'] = size
            return read_all(infos)

        else:
        # stream everything
            response.headers['Transfer-Encoding'] = 'chunked'

            return read_all(iter_infos())
