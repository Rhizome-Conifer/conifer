from bottle import request, response, HTTPError

from webrecorder.basecontroller import BaseController


# ============================================================================
class RecsController(BaseController):
    def __init__(self, *args, **kwargs):
        super(RecsController, self).__init__(*args, **kwargs)
        self.DOWNLOAD_REC_PATH = '{host}/{user}/{coll}/{rec}/$download'
        self.ANON_DOWNLOAD_REC_PATH = '{host}/anonymous/{rec}/$download'

    def init_routes(self):
        @self.app.post('/api/v1/recordings')
        def create_recording():
            user, coll = self.get_user_coll(api=True)

            title = request.forms.get('title')
            rec = self.sanitize_title(title)

            recording = self.manager.get_recording(user, coll, rec)
            if recording:
                response.status = 400
                return {'error_message': 'Recording Already Exists',
                        'id': rec,
                        'title': recording.get('title', title)
                       }

            recording = self.manager.create_recording(user, coll, rec, title)
            return {'recording': self._add_download_path(recording, user, coll)}

        @self.app.get('/api/v1/recordings')
        def get_recordings():
            user, coll = self.get_user_coll(api=True)

            rec_list = self.manager.get_recordings(user, coll)

            return {'recordings': [self._add_download_path(x, user, coll) for x in rec_list]}

        @self.app.get('/api/v1/recordings/<rec>')
        def get_recording(rec):
            user, coll = self.get_user_coll(api=True)

            recording = self.manager.get_recording(user, coll, rec)

            if not recording:
                response.status = 404
                return {'error_message': 'Recording not found', 'id': rec}

            return {'recording': self._add_download_path(recording, user, coll)}

        @self.app.delete('/api/v1/recordings/<rec>')
        def delete_recording(rec):
            user, coll = self.get_user_coll(api=True)
            self._ensure_rec_exists(user, coll, rec)

            self.manager.delete_recording(user, coll, rec)
            return {'deleted_id': rec}

        @self.app.post('/api/v1/recordings/<rec>/pages')
        def add_page(rec):
            user, coll = self.get_user_coll(api=True)
            self._ensure_rec_exists(user, coll, rec)

            page_data = {}
            for item in request.forms:
                page_data[item] = request.forms.get(item)

            self.manager.add_page(user, coll, rec, page_data)
            return {}

        @self.app.get('/api/v1/recordings/<rec>/pages')
        def list_pages(rec):
            user, coll = self.get_user_coll(api=True)
            self._ensure_rec_exists(user, coll, rec)

            pages = self.manager.list_pages(user, coll, rec)
            return {'pages': pages}

    def _add_download_path(self, rec_info, user, coll):
        if self.manager.is_anon(user):
            path = self.ANON_DOWNLOAD_REC_PATH
        else:
            path = self.DOWNLOAD_REC_PATH

        path = path.format(host=self.get_host(),
                           user=user,
                           coll=coll,
                           rec=rec_info['id'])

        rec_info['download_url'] = path
        return rec_info

    def _ensure_rec_exists(self, user, coll, rec):
        if not self.manager.has_recording(user, coll, rec):
            self._raise_error(404, 'Recording not found', api=True,
                              id=rec)

