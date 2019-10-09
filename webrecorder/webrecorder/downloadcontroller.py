from warcio.timeutils import timestamp_now
from warcio.warcwriter import BufferWARCWriter

from pywb.utils.loaders import BlockLoader
from pywb.utils.io import StreamIter, chunk_encode_iter

from webrecorder.basecontroller import BaseController
from webrecorder import __version__
from webrecorder.apiutils import wr_api_spec
from webrecorder.models.stats import Stats
from webrecorder.utils import get_bool

from bottle import response, request
from six.moves.urllib.parse import quote
from six import iteritems
from collections import OrderedDict
import gevent
import json


# ============================================================================
class DownloadController(BaseController):
    COPY_FIELDS = ('title', 'desc', 'size', 'updated_at', 'created_at', 'recorded_at', 'pages', 'lists',
                   'public', 'public_index')

    DEFAULT_REC_TITLE = 'Session from {0}'

    def __init__(self, *args, **kwargs):
        super(DownloadController, self).__init__(*args, **kwargs)
        config = kwargs['config']
        self.paths = config['url_templates']
        self.download_filename = config['download_paths']['filename']

        self.download_chunk_encoded = config['download_chunk_encoded']

    def init_routes(self):
        wr_api_spec.set_curr_tag('WASAPI (Downloads)')

        @self.app.get('/<user>/<coll>/<rec>/$download')
        def logged_in_download_rec_warc(user, coll, rec):
            self.redir_host()

            return self.handle_download(user, coll, rec)

        @self.app.get('/<user>/<coll>/$download')
        def logged_in_download_coll_warc(user, coll):
            self.redir_host()

            return self.handle_download(user, coll, '*')

        @self.app.get('/api/v1/download/webdata')
        @self.api(
            query=['?user', '?collection', '?commit'],
            resp='wasapi_list',
            description='List all files available for download, their locations and checksums, per WASAPI spec'
        )
        def wasapi_list_api():
            return self.wasapi_list()

        @self.app.get('/api/v1/download/<user>/<coll>/<filename>')
        @self.api(
            resp='wasapi_download',
            description='Download the specified WARC from a users collection, per WASAPI spec'
        )
        def wasapi_download_api(user, coll, filename):
            return self.wasapi_download(user, coll, filename)

        wr_api_spec.set_curr_tag(None)

    def create_warcinfo(self, creator, name, metadata, source, serialized, filename):
        for key, value in iteritems(serialized):
            if key in self.COPY_FIELDS:
                metadata[key] = value

        if not metadata.get('title'):
            metadata['title'] = self.DEFAULT_REC_TITLE.format(source.to_iso_date(metadata['created_at'], no_T=True))
            metadata['auto_title'] = True

        info = OrderedDict([
            ('software', 'Webrecorder Platform v' + __version__),
            ('format', 'WARC File Format 1.0'),
            ('creator', creator.name),
            ('isPartOf', name),
            ('json-metadata', json.dumps(metadata)),
        ])

        wi_writer = BufferWARCWriter()
        wi_writer.write_record(wi_writer.create_warcinfo_record(filename, info))
        return wi_writer.get_contents()

    def create_coll_warcinfo(self, user, collection, filename=''):
        metadata = {}
        metadata['type'] = 'collection'

        isPartOf_name = quote(collection.name)
        serialized = collection.serialize(include_recordings=False,
                                          include_lists=True,
                                          include_bookmarks='all-serialize',
                                          include_rec_pages=False,
                                          include_pages=False,
                                          convert_date=False)

        return self.create_warcinfo(user, isPartOf_name, metadata, collection, serialized, filename)

    def create_rec_warcinfo(self, user, collection, recording, filename=''):
        metadata = {}
        # metadata['pages'] = collection.list_rec_pages(recording)
        metadata['type'] = 'recording'
        # metadata['id'] = recording.my_id
        rec_type = recording.get_prop('rec_type')
        if rec_type:
            metadata['rec_type'] = rec_type

        isPartOf_name = quote(collection.name) + '/' + quote(recording.name)

        serialized = recording.serialize(include_pages=True,
                                         convert_date=False)

        return self.create_warcinfo(user, isPartOf_name, metadata, recording, serialized, filename)

    def handle_download(self, user, coll_name, recs):
        user, collection = self.user_manager.get_user_coll(user, coll_name)

        if not collection:
            self._raise_error(404, 'no_such_collection')

        self.access.assert_can_write_coll(collection)

        # collection['uid'] = coll
        collection.load()

        Stats(self.redis).incr_download(collection)

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
                    except Exception:
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

    def _get_wasapi_user(self, username=''):
        basic_auth = request.auth

        # if basic_auth, login as specified user, and user that as current user
        if basic_auth:
            user = self.user_manager.login_user_no_cookie(basic_auth[0], basic_auth[1])
            if not user:
                self._raise_error(404, 'invalid_login')

        else:
            # wasapi not supported for anon users
            user = self.access.session_user
            if user.is_anon():
                self._raise_error(404, 'not_found')

        # if username specified, override current/login user with specified user
        # only useful for admin access
        if username:
            user = self.user_manager.get_user(username)

        return user

    def wasapi_list(self):
        username = request.query.getunicode('user')

        # some clients use collection rather than coll_name so we must check for both
        coll_name = request.query.getunicode('collection')
        commit = get_bool(request.query.getunicode('commit'))

        user = self._get_wasapi_user()

        self.access.assert_is_curr_user(user)

        colls = None

        if coll_name:
            collection = user.get_collection_by_name(coll_name)
            if collection:
                colls = [collection]
            else:
                self._raise_error(404, 'no_such_collection')

        else:
            colls = user.get_collections()

        files = []
        download_path = self.get_origin() + '/api/v1/download/{user}/{coll}/{filename}'

        for collection in colls:
            if commit:
                commit_id = collection.commit_all()
                while commit_id:
                    gevent.sleep(10)
                    commit_id = collection.commit_all(commit_id)

            storage = collection.get_storage()
            for recording in collection.get_recordings():
                if not recording.is_fully_committed():
                    continue

                for name, path in recording.iter_all_files(include_index=False):
                    full_warc_path = collection.get_warc_path(name)

                    local_download = download_path.format(user=user.name, coll=collection.name, filename=name)
                    remote_download_url = storage.get_remote_presigned_url(full_warc_path)

                    # if remote download url exists (eg. for s3), include that first
                    # always include local download url as well
                    if remote_download_url:
                        locations = [remote_download_url, local_download]
                    else:
                        locations = [local_download]

                    kind, check_sum, size = storage.get_checksum_and_size(full_warc_path)
                    files.append({
                        'content-type': 'application/warc',
                        'filetype': 'application/warc',
                        'filename': name,
                        'size': size,
                        'recording': recording.my_id,
                        'recording_date': recording.get_prop('created_at'),
                        'collection': collection.name,
                        'checksums': {kind: check_sum},
                        'locations': locations,
                    })

        return {'files': files, 'include-extra': True}

    def wasapi_download(self, username, coll_name, filename):
        user = self._get_wasapi_user(username)

        if not user:
            self._raise_error(404, 'no_such_user')

        collection = user.get_collection_by_name(coll_name)

        if not collection:
            self._raise_error(404, 'no_such_collection')

        # self.access.assert_is_curr_user(user)
        # only users with write access can use wasapi
        self.access.assert_can_write_coll(collection)

        warc_key = collection.get_warc_key()
        warc_path = self.redis.hget(warc_key, filename)

        if not warc_path:
            self._raise_error(404, 'file_not_found')

        response.headers['Content-Type'] = 'application/octet-stream'
        response.headers['Content-Disposition'] = "attachment; filename*=UTF-8''" + filename
        response.headers['Transfer-Encoding'] = 'chunked'

        loader = BlockLoader()
        fh = None
        try:
            fh = loader.load(warc_path)
        except Exception:
            self._raise_error(400, 'file_load_error')

        def read_all(fh):
            for chunk in StreamIter(fh):
                yield chunk

        return read_all(fh)
