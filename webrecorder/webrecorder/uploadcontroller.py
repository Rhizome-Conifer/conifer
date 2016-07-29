from webrecorder.basecontroller import BaseController
from tempfile import SpooledTemporaryFile
from bottle import request


# ============================================================================
class UploadController(BaseController):
    def __init__(self, app, jinja_env, manager, config):
        super(UploadController, self).__init__(app, jinja_env, manager, config)

    def init_routes(self):
        @self.app.post('/_upload')
        def upload_file():
            upload = request.files.get('upload-file')
            if not upload:
                return {'error_message': 'no file'}

            print(upload.filename)
            with SpooledTemporaryFile(max_size=8192) as fh:
                upload.save(fh)
                print('SAVED', fh.tell())
                upload.file.close()


            return {'saved': 'true'}

