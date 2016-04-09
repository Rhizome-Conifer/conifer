from bottle import request, response, HTTPError

from webrecorder.basecontroller import BaseController
from webrecorder.webreccork import ValidationException


# ============================================================================
class CollsController(BaseController):
    def __init__(self, *args, **kwargs):
        super(CollsController, self).__init__(*args, **kwargs)
        self.DOWNLOAD_COLL_PATH = '{host}/{user}/{coll}/$download'
        self.ANON_DOWNLOAD_COLL_PATH = '{host}/anonymous/$download'

    def init_routes(self):
        @self.app.post('/api/v1/collections')
        def create_collection():
            user = self.get_user(api=True)

            title = request.forms.get('title')
            coll = self.sanitize_title(title)

            collection = self.manager.get_collection(user, coll)
            if collection:
                response.status = 400
                return {'error_message': 'Collection already exists',
                        'id': coll,
                        'title': collection.get('title', title)
                       }

            collection = self.manager.create_collection(user, coll, title)
            return {'collection': self._add_download_path(collection, user)}

        @self.app.get('/api/v1/collections')
        def get_collections():
            user = self.get_user(api=True)

            coll_list = self.manager.get_collections(user)

            return {'collections': [self._add_download_path(x, user) for x in coll_list]}

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

        @self.app.post('/api/v1/collections/<coll>/public')
        def set_public(coll):
            user = self.get_user(api=True)
            self._ensure_coll_exists(user, coll)

            public = self.post_get('public') == 'true'
            self.manager.set_public(user, coll, public)

        # Create Collection
        @self.app.get('/_create')
        @self.jinja2_view('create.html')
        def create_coll_view():
            self.manager.assert_logged_in()
            return {}

        @self.app.post('/_create')
        def create_coll_post():
            #self.manager.cork.require(role='archivist', fail_redirect='/')

            coll = self.post_get('collection')
            title = self.post_get('title', coll)
            is_public = self.post_get('public', 'private') == 'public'

            user = self.manager.get_curr_user()

            try:
                #self.manager.add_collection(user, coll_name, title, access)
                self.manager.create_collection(user, coll, title,
                                               desc='', public=is_public)
                self.flash_message('Created collection <b>{0}</b>!'.format(coll), 'success')
                redir_to = '/{user}/{coll}'.format(user=user, coll=coll)
            except ValidationException as ve:
                self.flash_message(str(ve))
                redir_to = '/_create'

            self.redirect(redir_to)

        # ANON COLLECTION
        @self.app.get(['/anonymous', '/anonymous/'])
        @self.jinja2_view('collection_info.html')
        def anon_coll_info():
            user = self.get_session().anon_user

            return self.get_collection_info_for_view(user, 'anonymous')

        # LOGGED-IN COLLECTION
        @self.app.get(['/<user>/<coll>', '/<user>/<coll>/'])
        @self.jinja2_view('collection_info.html')
        def coll_info(user, coll):
            return self.get_collection_info_for_view(user, coll)

    def get_collection_info_for_view(self, user, coll):
        result = self.get_collection_info(user, coll)
        if result.get('error_message'):
            self._raise_error(404, 'Collection not found')

        result['size_remaining'] = self.manager.get_size_remaining(user)
        result['user'] = self.get_view_user(user)
        result['coll'] = coll
        return result

    def get_collection_info(self, user, coll):
        collection = self.manager.get_collection(user, coll)

        if not collection:
            response.status = 404
            return {'error_message': 'Collection not found', 'id': coll}

        return {'collection': self._add_download_path(collection, user)}

    def _add_download_path(self, coll_info, user):
        if self.manager.is_anon(user):
            path = self.ANON_DOWNLOAD_COLL_PATH
        else:
            path = self.DOWNLOAD_COLL_PATH

        path = path.format(host=self.get_host(),
                           user=user,
                           coll=coll_info['id'])

        coll_info['download_url'] = path
        return coll_info

    def _ensure_coll_exists(self, user, coll):
        if not self.manager.has_collection(user, coll):
            self._raise_error(404, 'Collection not found', api=True, id=coll)

