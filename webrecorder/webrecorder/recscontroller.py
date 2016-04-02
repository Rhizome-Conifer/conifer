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
            user, coll = self.get_user_coll(api=True)

            title = request.forms.get('title')
            rec = self.sanitize_title(title)

            recording = self.manager.get_recording(user, coll, rec)
            if recording:
                response.status = 400
                return {'status': 'AlreadyExists',
                        'id': rec,
                        'title': title
                       }

            recording = self.manager.create_recording(user, coll, rec, title)
            return {'status': 'success', 'recording': recording}

        @self.app.get('/api/v1/recordings')
        def get_recordings():
            user, coll = self.get_user_coll(api=True)

            rec_list = self.manager.get_recordings(user, coll)

            return {'recordings': rec_list}

        @self.app.get('/api/v1/recordings/<rec>')
        def get_recording(rec):
            user, coll = self.get_user_coll(api=True)

            recording = self.manager.get_recording(user, coll, rec)

            if not recording:
                response.status = 404
                return {'status': 'NotFound', 'id': rec}

            return {'status': 'success', 'recording': recording}

    def sanitize_title(self, title):
        rec = title.lower()
        rec = rec.replace(' ', '-')
        rec = self.ALPHA_NUM_RX.sub('', rec)
        if self.WB_URL_COLLIDE.match(rec):
            rec += '_'

        return rec
