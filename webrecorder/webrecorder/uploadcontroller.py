from webrecorder.basecontroller import BaseController
from webrecorder.models.importer import UploadImporter

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
        @self.app.put('/_upload')
        def upload_file():
            if self.access.session_user.is_anon():
                return {'error_message': 'Sorry, uploads only available for logged-in users'}

            expected_size = int(request.headers['Content-Length'])

            if not expected_size:
                return {'error_message': 'No File Specified'}

            force_coll_name = request.query.getunicode('force-coll', '')
            filename = request.query.getunicode('filename')
            stream = request.environ['wsgi.input']
            user = self.access.session_user

            return self.uploader.upload_file(user,
                                    stream,
                                    expected_size,
                                    filename,
                                    force_coll_name)

        @self.app.get('/_upload/<upload_id>')
        def get_upload_status(upload_id):
            user = self.get_user(api=True)

            props = self.uploader.get_upload_status(user, upload_id)

            if not props:
                return {'error_message': 'upload expired'}

            return props

