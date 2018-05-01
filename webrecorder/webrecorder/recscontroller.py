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

            title = data.get('title', '')
            desc = data.get('desc', '')

            recording = collection.create_recording(title=title, desc=desc)

            return {'recording': recording.serialize()}

        @self.app.get('/api/v1/recordings')
        def get_recordings():
            user, collection = self.load_user_coll()

            recs = collection.get_recordings()

            return {'recordings': [rec.serialize() for rec in recs]}

        @self.app.get('/api/v1/recording/<rec>')
        def get_recording(rec):
            user, collection, recording = self.load_recording(rec)

            if recording:
                return {'recording': recording.serialize()}
            else:
                self._raise_error(404, 'recording_not_found')

        @self.app.post('/api/v1/recording/<rec>')
        def update_rec_desc(rec):
            user, collection, recording = self.load_recording(rec)

            user.access.assert_can_write_coll(collection)

            desc = request.json.get('desc', '')

            recording['desc'] = desc

            return {'recording': recording.serialize()}

        @self.app.delete('/api/v1/recording/<rec>')
        def delete_recording(rec):
            user, collection, recording = self.load_recording(rec)

            errs = collection.remove_recording(recording, delete=True)
            if errs:
                return errs
            else:
                return {'deleted_id': rec}

        @self.app.post('/api/v1/recording/<rec>/move/<new_coll_name>')
        def move_recording(rec, new_coll_name):
            user, collection, recording = self.load_recording(rec)

            new_collection = user.get_collection_by_name(new_coll_name)
            if not new_collection:
                self._raise_error(400, 'no_such_collection')

            user.access.assert_can_admin_coll(new_collection)

            #new_rec = collection.move(recording, new_collection, allow_dupe=True)
            new_rec = collection.move_recording(recording, new_collection)

            if new_rec:
                #msg = 'Recording <b>{0}</b> moved to collection <a href="{1}"><b>{2}</b></a>'
                #msg = msg.format(rec, self.get_path(user.name, new_coll_name), new_coll_name)
                #self.flash_message(msg, 'success')
                return {'coll_id': new_coll_name, 'rec_id': new_rec}
            else:
                self._raise_error(400, 'error_move_recording')

        @self.app.post('/api/v1/recording/<rec>/copy/<new_coll_name>')
        def copy_recording(rec, new_coll_name):
            user, collection, recording = self.load_recording(rec)

            new_collection = user.get_collection_by_name(new_coll_name)
            if not new_collection:
                return self._raise_error(400, 'no_such_collection')

            user.access.assert_can_write_coll(collection)
            user.access.assert_can_admin_coll(new_collection)

            new_rec = new_collection.create_recording()

            if new_rec.copy_data_from_recording(recording):
                return {'recording': new_rec.serialize()}
            else:
                return self._raise_error(400, 'copy_error')

        @self.app.post('/api/v1/recording/<rec>/pages')
        def add_page(rec):
            user, collection, recording = self.load_recording(rec)

            page_data = request.json

            page_id = collection.add_page(page_data, recording)
            return {'page_id': page_id}

        @self.app.post('/api/v1/recording/<rec>/page')
        def modify_page(rec):
            user, collection, recording = self.load_recording(rec)

            page_data = request.json

            res = recording.modify_page(page_data)
            return {'page-data': page_data, 'recording-id': rec}

        @self.app.get('/api/v1/recording/<rec>/pages')
        def list_pages(rec):
            user, collection, recording = self.load_recording(rec)

            pages = collection.list_rec_pages(recording)
            return {'pages': pages}

        @self.app.get('/api/v1/recording/<rec>/num_pages')
        def get_num_pages(rec):
            user, collection, recording = self.load_recording(rec)

            return {'count': recording.count_pages() }

        @self.app.delete('/api/v1/recording/<rec>/pages')
        def delete_page(rec):
            user, collection, recording = self.load_recording(rec)

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
        @self.app.post('/_delete_rec/<rec>')
        def delete_rec_post(rec):
            self.validate_csrf()
            user, collection, recording = self.load_recording(rec, api=False)
            success = False
            try:
                success = collection.delete_recording(recording)
            except Exception as e:
                print(e)

            if success:
                self.flash_message('Recording {0} has been deleted!'.format(rec), 'success')
                self.redirect(self.get_path(user.name, collection.name))
            else:
                self.flash_message('There was an error deleting {0}'.format(rec))
                self.redirect(self.get_path(user.name, collection.name, rec))

    def get_rec_info_for_new(self, user, coll_name, rec, action):
        result = {'curr_mode': 'new', 'action': action}
        result['user'] = user

        user, collection = self.load_user_coll(user=user, coll_name=coll_name)

        result['coll'] = coll_name

        result['coll_title'] = quote(collection.get_prop('title'))

        return result

    def load_recording(self, rec, user=None, coll_name=None):
        user, collection = self.load_user_coll(user=user, coll_name=coll_name)
        if not user or not collection:
            self._raise_error(404, 'recording_not_found')

        recording = collection.get_recording(rec)
        if not recording:
            self._raise_error(404, 'recording_not_found')

        return user, collection, recording
