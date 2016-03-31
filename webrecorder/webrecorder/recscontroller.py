import re
from bottle import request, response, HTTPError

from webrecorder.basecontroller import BaseController


# ============================================================================
class RecsController(BaseController):
    ALPHA_NUM_RX = re.compile('[^\w-]')

    WB_URL_COLLIDE = re.compile('^([\d]+([\w]{2}_)?|([\w]{2}_))$')

    def init_routes(self):
        @self.app.post('/api/v1/recordings')
        def create_recording():
            user, coll = self.get_user_coll()

            title = request.forms.get('title')
            id = self.sanitize_title(title)

            recording = self.manager.get_recording(user, coll, id)
            if recording:
                response.status = 400
                return {'status': 'AlreadyExists',
                        'id': id,
                        'title': title
                       }

            recording = self.manager.create_recording(user, coll, id, title)
            return {'status': 'success', 'recording': recording}

        @self.app.get('/api/v1/recordings')
        def get_recordings():
            user, coll = self.get_user_coll()

            rec_list = self.manager.get_recordings(user, coll)

            return {'recordings': rec_list}

        @self.app.get('/api/v1/recordings/<id>')
        def get_recording(id):
            user, coll = self.get_user_coll()

            recording = self.manager.get_recording(user, coll, id)

            if not recording:
                response.status = 404
                return {'status': 'NotFound', 'id': id}

            return {'status': 'success', 'recording': recording}

    def sanitize_title(self, title):
        id = title.lower()
        id = id.replace(' ', '-')
        id = self.ALPHA_NUM_RX.sub('', id)
        if self.WB_URL_COLLIDE.match(id):
            id += '_'

        return id
