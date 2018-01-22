from bottle import request, response
from six.moves.urllib.parse import quote

from webrecorder.basecontroller import BaseController


# ============================================================================
class RecsController(BaseController):
    def init_routes(self):
        @self.app.post('/api/v1/recordings')
        def create_recording():
            user, coll = self.get_user_coll(api=True)

            title = request.forms.getunicode('title')

            coll_title = request.forms.getunicode('coll_title')

            rec = self.sanitize_title(title)

            recording = self.manager.create_recording(user, coll, rec, title, coll_title)

            return {'recording': recording}

        @self.app.get('/api/v1/recordings')
        def get_recordings():
            user, coll = self.get_user_coll(api=True)

            rec_list = self.manager.get_recordings(user, coll)

            return {'recordings': rec_list}

        @self.app.get('/api/v1/recordings/<rec_name>')
        def get_recording(rec_name):
            user, coll = self.get_user_coll(api=True)
            rec = self._ensure_rec_exists(user, coll, rec_name)

            rec_info = self.get_rec_info(user, coll, rec, rec_name)
            if rec_info.get('recording'):
                rec_info['recording']['id'] = rec_name

            return rec_info

        @self.app.delete('/api/v1/recordings/<rec_name>')
        def delete_recording(rec_name):
            user, coll = self.get_user_coll(api=True)
            rec = self._ensure_rec_exists(user, coll, rec_name)

            if self.manager.delete_recording(user, coll, rec):
                return {'deleted_id': rec_name}
            else:
                return {}

        @self.app.post('/api/v1/recordings/<rec_name>/rename/<new_rec_title:path>')
        def rename_recording(rec_name, new_rec_title):
            user, coll = self.get_user_coll(api=True)
            rec = self._ensure_rec_exists(user, coll, rec_name)

            new_rec_name = self.sanitize_title(new_rec_title)

            if not new_rec_name:
                err_msg = 'invalid recording title ' + new_rec_title
                return {'error_message': err_msg}

            #if rec_name == new_rec_name:
            #    self.manager.set_rec_prop(user, coll, rec, 'title', new_rec_title)
            #    return {'rec_id': rec, 'coll_id': coll, 'title': new_rec_title}

            res = self.manager.rename_recording(user=user,
                                                from_coll=coll,
                                                from_rec_name=rec_name,
                                                to_coll=coll,
                                                to_rec_name=new_rec_name,
                                                to_rec_title=new_rec_title,
                                                rec=rec)

            if not res:
                return {'error_message': 'not found'}

            coll_name = request.query.getunicode('coll')

            return {'coll_id': coll_name,
                    'rec_id': res[1],
                    'title': res[2]
                   }


        @self.app.post('/api/v1/recordings/<rec_title>/move/<new_coll_title>')
        def move_recording(rec_title, new_coll_title):
            user, coll = self.get_user_coll(api=True)
            rec_name = self.sanitize_title(rec_title)
            rec = self._ensure_rec_exists(user, coll, rec_name)

            new_coll = self.sanitize_title(new_coll_title)

            rec_title = self.manager.get_recording_title(user, coll, rec)

            res = self.manager.rename(user=user,
                                      coll=coll,
                                      new_coll=new_coll,
                                      rec=rec,
                                      new_rec=rec,
                                      title=rec_title,
                                      is_move=True)

            if 'coll_id' in res:
                msg = 'Recording <b>{0}</b> moved to collection <a href="{1}"><b>{2}</b></a>'
                msg = msg.format(rec_title, self.get_path(user, new_coll), new_coll_title)
                self.flash_message(msg, 'success')
            else:
                self.flash_message('Error moving {0}: {1}'.format(rec_title, res.get('error_message')))


            return res

        @self.app.post('/api/v1/recordings/<rec>/pages')
        def add_page(rec):
            user, coll = self.get_user_coll(api=True)
            rec = self._ensure_rec_exists(user, coll, rec)

            page_data = dict(request.forms.decode())

            res = self.manager.add_page(user, coll, rec, page_data)
            return res

        @self.app.post('/api/v1/recordings/<rec>/page')
        def modify_page(rec):
            user, coll = self.get_user_coll(api=True)
            rec = self._ensure_rec_exists(user, coll, rec)

            page_data = dict(request.forms.decode())

            res = self.manager.modify_page(user, coll, rec, page_data)
            return {'page-data': page_data, 'recording-id': rec}

        @self.app.get('/api/v1/recordings/<rec>/pages')
        def list_pages(rec):
            user, coll = self.get_user_coll(api=True)
            rec = self._ensure_rec_exists(user, coll, rec)

            pages = self.manager.list_pages(user, coll, rec)
            return {'pages': pages}

        @self.app.post('/api/v1/recordings/<rec>/tag')
        @self.manager.beta_user()
        def tag_page(rec):
            user, coll = self.get_user_coll(api=True)

            # check recording exists and user has write permissions
            rec = self._ensure_rec_exists(user, coll, rec)
            self.manager.assert_can_write(user, coll)

            page_data = request.json
            tags = page_data.get('tags', [])
            pg_id = page_data.get('id', None)

            if pg_id:
                self.manager.tag_page(tags, user, coll, rec, pg_id)

        @self.app.get('/api/v1/recordings/<rec>/num_pages')
        def get_num_pages(rec):
            user, coll = self.get_user_coll(api=True)

            return {'count': self.manager.count_pages(user, coll, rec) }

        @self.app.delete('/api/v1/recordings/<rec>/pages')
        def delete_page(rec):
            user, coll = self.get_user_coll(api=True)
            rec = self._ensure_rec_exists(user, coll, rec)

            url = request.forms.getunicode('url')
            ts = request.forms.getunicode('timestamp')

            return self.manager.delete_page(user, coll, rec, url, ts)

        # LOGGED-IN NEW REC
        @self.app.get(['/<user>/<coll>/$new', '/<user>/<coll>/$new/'])
        @self.jinja2_view('new_recording.html')
        def new_recording(user, coll):

            return self.get_rec_info_for_new(user, coll, None, 'new_recording')

        # LOGGED-IN ADD TO REC
        @self.app.get(['/<user>/<coll>/<rec>/$add', '/<user>/<coll>/<rec>/$add/'])
        @self.jinja2_view('add_to_recording.html')
        def add_to_recording(user, coll, rec):

            return self.get_rec_info_for_new(user, coll, rec, 'add_to_recording')

        # LOGGED-IN REC VIEW
        #@self.app.get(['/<user>/<coll>/<rec>', '/<user>/<coll>/<rec>/'])
        #@self.jinja2_view('recording_info.html')
        #def rec_info(user, coll, rec):

        #    return self.get_rec_info_for_view(user, coll, rec)

        # DELETE REC
        @self.app.post('/_delete_rec/<rec>')
        def delete_rec_post(rec):
            self.validate_csrf()
            user, coll = self.get_user_coll(api=False)

            success = False
            try:
                success = self.manager.delete_recording(user, coll, rec)
            except Exception as e:
                print(e)

            if success:
                self.flash_message('Recording {0} has been deleted!'.format(rec), 'success')
                self.redirect(self.get_path(user, coll))
            else:
                self.flash_message('There was an error deleting {0}'.format(rec))
                self.redirect(self.get_path(user, coll, rec))

    def get_rec_info(self, user, coll, rec, rec_name):
        recording = self.manager.get_recording(user, coll, rec)

        if not recording:
            response.status = 404
            return {'error_message': 'Recording not found', 'id': rec_name}

        return {'recording': recording}

    def get_rec_info_for_new(self, user, coll_name, rec_name, action):
        result = {'curr_mode': 'new', 'action': action}
        result['user'] = self.get_view_user(user)

        coll, rec = self.manager.get_coll_rec_ids(user, coll_name, rec_name)

        result['coll'] = coll
        result['rec'] = rec

        collection = self.manager.get_collection(user, coll)
        if not collection:
            self._raise_error(404, 'Collection not found')

        result['coll_title'] = quote(collection['title'])

        if rec:
            recording = self.manager.get_recording(user, coll, rec)
            if not recording:
                self._raise_error(404, 'Recording not found')

            result['rec_title'] = recording['title']

        return result

    def _ensure_rec_exists(self, user, coll, rec_name):
        rec = self.manager.recs_map.name_to_id(coll, rec_name)
        if not self.manager.has_recording(user, coll, rec):
            self._raise_error(404, 'Recording not found', api=True,
                              id=rec_name)

        return rec

