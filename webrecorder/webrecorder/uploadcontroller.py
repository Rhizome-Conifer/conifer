from webrecorder.apiutils import wr_api_spec
from webrecorder.basecontroller import BaseController
from webrecorder.models.importer import UploadImporter
from webrecorder.models.stats import Stats

from bottle import request


# ============================================================================
class UploadController(BaseController):
    def __init__(self, *args, **kwargs):
        super(UploadController, self).__init__(*args, **kwargs)
        content_app = kwargs['content_app']

        self.uploader = UploadImporter(self.redis,
                                       self.config,
                                       wam_loader=content_app.wam_loader)

    def init_routes(self):
        wr_api_spec.set_curr_tag('Uploads')

        @self.app.put(['/_upload', '/api/v1/upload'])
        def upload_file():
            user = self.access.session_user
            force_coll_name = request.query.getunicode('force-coll', '')

            if force_coll_name:
                collection = user.get_collection_by_name(force_coll_name)
            else:
                collection = None

            # allow uploading to external collections
            if not collection or not collection.is_external():
                if user.is_anon():
                    return self._raise_error(400, 'not_logged_in')

            expected_size = int(request.headers['Content-Length'])

            if not expected_size:
                return self._raise_error(400, 'no_file_specified')

            filename = request.query.getunicode('filename')
            stream = request.environ['wsgi.input']

            res = self.uploader.upload_file(user,
                                    stream,
                                    expected_size,
                                    filename,
                                    force_coll_name)

            if 'error' in res:
                return self._raise_error(400, res['error'])

            Stats(self.redis).incr_upload(user, expected_size)
            return res

        @self.app.get(['/_upload/<upload_id>', '/api/v1/upload/<upload_id>'])
        def get_upload_status(upload_id):
            user = self.get_user(api=True)

            props = self.uploader.get_upload_status(user, upload_id)

            if not props:
                return self._raise_error(400, 'upload_expired')

            return props

