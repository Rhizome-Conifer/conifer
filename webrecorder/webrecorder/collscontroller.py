from bottle import request, response, HTTPError

import re

from webrecorder.basecontroller import BaseController
from webrecorder.webreccork import ValidationException
import json


# ============================================================================
class CollsController(BaseController):
    def __init__(self, app, jinja_env, manager, config):
        super(CollsController, self).__init__(app, jinja_env, manager, config)
        self.default_coll_desc = config['coll_desc']

    def init_routes(self):
        @self.app.post('/api/v1/collections')
        def create_collection():
            user = self.get_user(api=True)

            title = request.forms.getunicode('title')

            coll = self.sanitize_title(title)

            if not coll:
                return {'error_message': 'Invalid Collection Name'}

            is_public = self.post_get('public') == 'on'

            if self.manager.is_anon(user) and coll != 'temp':
                return {'error_message': 'Only temp collection available'}

            try:
                collection = self.manager.create_collection(user, coll, title,
                                                            desc='', public=is_public)
                self.flash_message('Created collection <b>{0}</b>!'.format(collection['title']), 'success')
                resp = {'collection': collection}
            except ValidationException as ve:
                self.flash_message(str(ve))
                resp = {'error_message': str(ve)}

            return resp

        @self.app.get('/api/v1/collections')
        def get_collections():
            user = self.get_user(api=True)

            coll_list = self.manager.get_collections(user)

            return {'collections': coll_list}

        @self.app.get('/api/v1/collections/<coll>')
        def get_collection(coll):
            user = self.get_user(api=True)

            return self.get_collection_info(user, coll)

        @self.app.delete('/api/v1/collections/<coll>')
        def delete_collection(coll):
            user = self.get_user(api=True)

            self._ensure_coll_exists(user, coll)

            self.manager.delete_collection(user, coll)

            return {'deleted_id': coll}

        @self.app.post('/api/v1/collections/<coll>/rename/<new_coll_title>')
        def rename_collection(coll, new_coll_title):
            user = self.get_user(api=True)

            self._ensure_coll_exists(user, coll)

            new_coll = self.sanitize_title(new_coll_title)

            if coll == new_coll:
                self.manager.set_coll_prop(user, coll, 'title', new_coll_title)
                return {'rec_id': '*', 'coll_id': new_coll, 'title': new_coll_title}

            #if self.manager.has_collection(user, new_coll):
            #    err_msg = 'collection "{0}" already exists'.format(new_coll)
            #    return {'error_message': err_msg}

            res = self.manager.rename(user=user,
                                      coll=coll,
                                      new_coll=new_coll,
                                      title=new_coll_title)

            return res


        @self.app.post('/api/v1/collections/<coll>/public')
        def set_public(coll):
            user = self.get_user(api=True)
            self._ensure_coll_exists(user, coll)

            # TODO: notify the user if this is a request from the admin panel
            if self.post_get('notify') == 'true' and self.manager.is_superuser():
                pass

            public = self.post_get('public') == 'true'
            self.manager.set_public(user, coll, public)

        @self.app.post('/api/v1/collections/<coll>/desc')
        def update_desc(coll):
            user = self.get_user(api=True)
            self._ensure_coll_exists(user, coll)

            desc = request.body.read().decode('utf-8')

            self.manager.set_coll_prop(user, coll, 'desc', desc)
            return {}

        @self.app.get('/api/v1/collections/<coll>/num_pages')
        def get_num_pages(coll):
            user = self.get_user(api=True)

            return {'count': self.manager.count_pages(user, coll, rec='*') }

        @self.app.post('/api/v1/collections/<coll>/mounts')
        def update_mount(coll):
            user = self.get_user(api=True)
            self._ensure_coll_exists(user, coll)

            type_ = request.forms.get('mount_type')

            if type_ == 'ait':
                ait_colls = request.forms.getunicode('ait_colls', '')
                if ait_colls:
                    ait_colls = ait_colls.replace(' ', '')
                    mount_info = {'ait': 'ait://' + ait_colls}
                else:
                    mount_info = None

                self.manager.set_mount(user, coll, mount_info)
                return {}
            else:
                return {'error_message': 'unsupported mount type'}


        # Create Collection
        @self.app.get('/_create')
        @self.jinja2_view('create_collection.html')
        def create_coll_view():
            self.manager.assert_logged_in()
            return {}

        @self.app.post('/_create')
        def create_coll_post():
            title = self.post_get('title')
            if not title:
                self.flash_message('Title is required')
                self.redirect('/_create')

            is_public = self.post_get('public') == 'on'

            coll = self.sanitize_title(title)

            user = self.manager.get_curr_user()

            try:
                if not coll:
                    raise ValidationException('Invalid Collection Name')

                #self.manager.add_collection(user, coll_name, title, access)
                collection = self.manager.create_collection(user, coll, title,
                                                            desc='', public=is_public)
                self.flash_message('Created collection <b>{0}</b>!'.format(collection['title']), 'success')
                redir_to = self.get_redir_back('/_create')
            except ValidationException as ve:
                self.flash_message(str(ve))
                redir_to = '/_create'

            self.redirect(redir_to)

        @self.app.post(['/_delete_coll'])
        def delete_collection_post():
            user, coll = self.get_user_coll(api=False)

            success = False
            try:
                success = self.manager.delete_collection(user, coll)
            except Exception as e:
                print(e)

            if success:
                self.flash_message('Collection {0} has been deleted!'.format(coll), 'success')

                # if anon user/temp collection, delete user and redirect to homepage
                if self.manager.is_anon(user):
                    self.get_session().delete()

                    if self.content_host:
                        self.redir_host(self.content_host, '/_clear_session?path=/')
                    else:
                        self.redirect('/')
                else:
                    self.redirect(self.get_path(user))

            else:
                self.flash_message('There was an error deleting {0}'.format(coll))
                self.redirect(self.get_path(user, coll))

        # Collection view (all recordings)
        @self.app.get(['/<user>/<coll>', '/<user>/<coll>/'])
        @self.jinja2_view('collection_info.html')
        def coll_info(user, coll):
            return self.get_collection_info_for_view(user, coll)

        @self.app.get(['/<user>/<coll>/<rec_list:re:([\w,-]+)>', '/<user>/<coll>/<rec_list:re:([\w,-]+)>/'])
        @self.jinja2_view('collection_info.html')
        def coll_info(user, coll, rec_list):
            rec_list = [self.sanitize_title(title) for title in rec_list.split(',')]
            return self.get_collection_info_for_view(user, coll, rec_list)

    def get_collection_info_for_view(self, user, coll, rec_list=None):
        result = self.get_collection_info(user, coll)
        if result.get('error_message'):
            self._raise_error(404, 'Collection not found')


        if self.manager.get_curr_user() == user:
            result['collections'] = self.manager.get_collections(self.manager.get_curr_user())

        result['size_remaining'] = self.manager.get_size_remaining(user)
        result['user'] = self.get_view_user(user)
        result['coll'] = coll
        result['bookmarks'] = []

        result['rec_title'] = ''
        result['coll_title'] = result['collection']['title']

        result['mount_info'] = self.manager.get_mount(user, coll) or '{}'

        for rec in result['collection']['recordings']:
           rec['pages'] = self.manager.list_pages(user, coll, rec['id'])
           result['bookmarks'].append(rec['pages'])

        if not result['collection'].get('desc'):
            result['collection']['desc'] = self.default_coll_desc.format(result['coll_title'])

        rec_list = rec_list or []
        result['rec_list'] = json.dumps(rec_list)

        return result

    def get_collection_info(self, user, coll):
        collection = self.manager.get_collection(user, coll)

        if not collection:
            response.status = 404
            return {'error_message': 'Collection not found', 'id': coll}

        return {'collection': collection}

    def _ensure_coll_exists(self, user, coll):
        if not self.manager.has_collection(user, coll):
            self._raise_error(404, 'Collection not found', api=True, id=coll)

