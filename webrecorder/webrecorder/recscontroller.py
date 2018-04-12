from bottle import request, response
from six.moves.urllib.parse import quote

from webrecorder.basecontroller import BaseController
from webrecorder.models import User, Collection, Recording


# ============================================================================
class RecsController(BaseController):
    def init_routes(self):
        @self.app.post('/api/v1/recordings')
        def create_recording():
            user, collection = self.load_user_coll()

            data = request.json or {}

            rec_title = data.get('title', '')
            rec_title = self.sanitize_title(rec_title)

            desc = data.get('desc', '')

            recording = collection.create_recording(rec_title, desc=desc)

            return {'recording': recording.serialize()}

        @self.app.get('/api/v1/recordings')
        def get_recordings():
            user, collection = self.load_user_coll()

            recs = collection.get_recordings()

            return {'recordings': [rec.serialize() for rec in recs]}

        @self.app.get('/api/v1/recordings/<rec_name>')
        def get_recording(rec_name):
            user, collection, recording = self.load_recording(rec_name)

            if recording:
                return {'recording': recording.serialize()}
            else:
                return {'error_message': 'Recording not found', 'id': rec_name}

        @self.app.post('/api/v1/recordings/<rec_name>/update_desc')
        def update_rec_desc(rec_name):
            user, collection, recording = self.load_recording(rec_name)

            user.access.assert_can_write_coll(collection)

            desc = request.json.get('desc', '')

            recording['desc'] = desc

            return {'recording': recording.serialize()}

        @self.app.delete('/api/v1/recordings/<rec_name>')
        def delete_recording(rec_name):
            user, collection, recording = self.load_recording(rec_name)

            if collection.remove_recording(recording, user, delete=True):
                return {'deleted_id': rec_name}

            return {}

        @self.app.post('/api/v1/recordings/<rec_name>/move/<new_coll_name>')
        def move_recording(rec_name, new_coll_name):
            user, collection, recording = self.load_recording(rec_name)

            new_collection = user.get_collection_by_name(new_coll_name)
            if not new_collection:
                return {'error_message': 'No Collection: ' + new_coll_name}

            user.access.assert_can_admin_coll(new_collection)

            new_rec_name = collection.move(recording, new_collection, allow_dupe=True)

            if new_rec_name:
                msg = 'Recording <b>{0}</b> moved to collection <a href="{1}"><b>{2}</b></a>'
                msg = msg.format(rec_name, self.get_path(user.name, new_coll_name), new_coll_name)
                self.flash_message(msg, 'success')
                return {'coll_id': new_coll_name, 'rec_id': new_rec_name}
            else:
                msg = 'Error Moving'
                self.flash_message(msg, 'error')
                return {'error_message': msg}


        @self.app.post('/api/v1/recordings/<rec_name>/copy/<new_coll_name>')
        def copy_recording(rec_name, new_coll_name):
            user, collection, recording = self.load_recording(rec_name)

            new_collection = user.get_collection_by_name(new_coll_name)
            if not new_collection:
                return {'error_message': 'No Collection: ' + new_coll_name}

            user.access.assert_can_write_coll(collection)
            user.access.assert_can_admin_coll(new_collection)

            new_rec = new_collection.create_recording(rec_name)

            #new_rec.copy_data_from_recording(recording)
            new_rec.queue_copy(recording)

            return {'recording': new_rec.serialize()}

        @self.app.post('/api/v1/recordings/<rec_name>/pages')
        def add_page(rec_name):
            user, collection, recording = self.load_recording(rec_name)

            page_data = request.json

            res = recording.add_page(page_data)
            return res

        @self.app.post('/api/v1/recordings/<rec_name>/page')
        def modify_page(rec_name):
            user, collection, recording = self.load_recording(rec_name)

            page_data = request.json

            res = recording.modify_page(page_data)
            return {'page-data': page_data, 'recording-id': rec_name}

        @self.app.get('/api/v1/recordings/<rec_name>/pages')
        def list_pages(rec_name):
            user, collection, recording = self.load_recording(rec_name)

            pages = recording.list_pages()
            return {'pages': pages}

        @self.app.get('/api/v1/recordings/<rec_name>/num_pages')
        def get_num_pages(rec_name):
            user, collection, recording = self.load_recording(rec_name)

            return {'count': recording.count_pages() }

        @self.app.delete('/api/v1/recordings/<rec_name>/pages')
        def delete_page(rec_name):
            user, collection, recording = self.load_recording(rec_name)

            url = request.json.get('url')
            ts = request.json.get('timestamp')

            return recording.delete_page(url, ts)

        # LOGGED-IN NEW REC
        @self.app.get(['/<user>/<coll_name>/$new', '/<user>/<coll_name>/$new/'])
        @self.jinja2_view('new_recording.html')
        def new_recording(user, coll_name):

            return self.get_rec_info_for_new(user, coll_name, None, 'new_recording')

        # LOGGED-IN ADD TO REC
        # DELETE REC
        @self.app.post('/_delete_rec/<rec_name>')
        def delete_rec_post(rec_name):
            self.validate_csrf()
            user, collection, recording = self.load_recording(rec_name, api=False)
            success = False
            try:
                success = collection.delete_recording(recording)
            except Exception as e:
                print(e)

            if success:
                self.flash_message('Recording {0} has been deleted!'.format(rec_name), 'success')
                self.redirect(self.get_path(user.name, collection.name))
            else:
                self.flash_message('There was an error deleting {0}'.format(rec_name))
                self.redirect(self.get_path(user.name, collection.name, rec_name))

    def get_rec_info_for_new(self, user, coll_name, rec_name, action):
        result = {'curr_mode': 'new', 'action': action}
        result['user'] = user

        user, collection = self.load_user_coll(user=user, coll_name=coll_name)

        result['coll'] = coll_name

        result['coll_title'] = quote(collection.get_prop('title'))

        return result

    def load_recording(self, rec_name, user=None, coll_name=None):
        user, collection = self.load_user_coll(user=user, coll_name=coll_name)
        if not user or not collection:
            self._raise_error(404, 'Recording not found', api=True,
                              id=rec_name)

        recording = collection.get_recording_by_name(rec_name)
        if not recording:
            self._raise_error(404, 'Recording not found', api=True,
                              id=rec_name)

        return user, collection, recording
