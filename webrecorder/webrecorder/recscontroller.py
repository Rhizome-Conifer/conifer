from bottle import request, response
from six.moves.urllib.parse import quote

from webrecorder.basecontroller import BaseController, wr_api_spec
from webrecorder.models import User, Collection, Recording


# ============================================================================
class RecsController(BaseController):
    def init_routes(self):
        wr_api_spec.set_curr_tag('Recordings')

        @self.app.post('/api/v1/recordings')
        @self.api(query=['user', 'coll'],
                  req=['title', 'desc'],
                  resp='recording')
        def create_recording():
            user, collection = self.load_user_coll()

            data = request.json or {}

            title = data.get('title', '')
            desc = data.get('desc', '')

            recording = collection.create_recording(title=title, desc=desc)

            collection.mark_updated()

            return {'recording': recording.serialize()}

        @self.app.get('/api/v1/recordings')
        @self.api(query=['user', 'coll'],
                  resp='recordings')
        def get_recordings():
            user, collection = self.load_user_coll()

            recs = collection.get_recordings()

            return {'recordings': [rec.serialize() for rec in recs]}

        @self.app.get('/api/v1/recording/<rec>')
        @self.api(query=['user', 'coll'],
                  resp='recording')
        def get_recording(rec):
            user, collection, recording = self.load_recording(rec)

            if recording:
                return {'recording': recording.serialize()}
            else:
                self._raise_error(404, 'no_such_recording')

        @self.app.post('/api/v1/recording/<rec>')
        @self.api(query=['user', 'coll'],
                  req=['desc'],
                  resp='recording')
        def update_rec_desc(rec):
            user, collection, recording = self.load_recording(rec)

            user.access.assert_can_write_coll(collection)

            data = request.json or {}

            desc = data.get('desc', '')

            recording['desc'] = desc

            recording.mark_updated()
            return {'recording': recording.serialize()}

        @self.app.delete('/api/v1/recording/<rec>')
        @self.api(query=['user', 'coll'],
                  resp='deleted')
        def delete_recording(rec):
            user, collection, recording = self.load_recording(rec)

            errs = collection.remove_recording(recording, delete=True)
            if errs.get('error'):
                return self._raise_error(400, errs['error'])
            else:
                return {'deleted_id': rec}

        @self.app.post('/api/v1/recording/<rec>/move/<new_coll_name>')
        @self.api(query=['user', 'coll'],
                  resp='rec_move')
        def move_recording(rec, new_coll_name):
            user, collection, recording = self.load_recording(rec)

            new_collection = user.get_collection_by_name(new_coll_name)
            if not new_collection:
                self._raise_error(400, 'no_such_collection')

            user.access.assert_can_admin_coll(new_collection)

            new_rec = collection.move_recording(recording, new_collection)

            if new_rec:
                collection.mark_updated()
                new_collection.mark_updated()
                return {'coll_id': new_coll_name, 'rec_id': new_rec}
            else:
                self._raise_error(400, 'move_error')

        @self.app.post('/api/v1/recording/<rec>/copy/<new_coll_name>')
        @self.api(query=['user', 'coll'],
                  resp='recording')
        def copy_recording(rec, new_coll_name):
            user, collection, recording = self.load_recording(rec)

            new_collection = user.get_collection_by_name(new_coll_name)
            if not new_collection:
                return self._raise_error(400, 'no_such_collection')

            user.access.assert_can_write_coll(collection)
            user.access.assert_can_admin_coll(new_collection)

            new_rec = new_collection.create_recording()

            if new_rec.copy_data_from_recording(recording):
                new_rec.mark_updated()
                return {'recording': new_rec.serialize()}
            else:
                return self._raise_error(400, 'copy_error')

        @self.app.post('/api/v1/recording/<rec>/pages')
        @self.api(query=['user', 'coll'],
                  req=['url', 'timestamp', 'title', 'browser'],
                  resp='page_id')
        def add_page(rec):
            user, collection, recording = self.load_recording(rec)

            page_data = request.json or {}

            page_id = collection.add_page(page_data, recording)
            recording.mark_updated()
            return {'page_id': page_id}

        @self.app.get('/api/v1/recording/<rec>/pages')
        @self.api(query=['user', 'coll'],
                  resp='pages')
        def list_pages(rec):
            user, collection, recording = self.load_recording(rec)

            pages = collection.list_rec_pages(recording)
            return {'pages': pages}

        @self.app.get('/api/v1/recording/<rec>/num_pages')
        @self.api(query=['user', 'coll'],
                  resp='count_pages')
        def get_num_pages(rec):
            user, collection, recording = self.load_recording(rec)

            return {'count': recording.count_pages() }

        @self.app.delete('/api/v1/recording/<rec>/pages')
        @self.api(query=['user', 'coll'],
                  resp='deleted')
        def delete_page(rec):
            user, collection, recording = self.load_recording(rec)

            url = request.json.get('url')
            ts = request.json.get('timestamp')

            return recording.delete_page(url, ts)

        wr_api_spec.set_curr_tag(None)

    def load_recording(self, rec, user=None, coll_name=None):
        user, collection = self.load_user_coll(user=user, coll_name=coll_name)
        if not user or not collection:
            self._raise_error(404, 'no_such_recording')

        recording = collection.get_recording(rec)
        if not recording:
            self._raise_error(404, 'no_such_recording')

        return user, collection, recording
