from bottle import request, response, HTTPError

from webrecorder.basecontroller import BaseController


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

            collection = self.manager.get_collection(user, coll)

            if not collection:
                response.status = 404
                return {'error_message': 'Collection not found', 'id': coll}

            return {'collection': self._add_download_path(collection, user)}

        @self.app.delete('/api/v1/collections/<coll>')
        def delete_collection(coll):
            user = self.get_user(api=True)
            self._ensure_coll_exists(user, coll)

            self.manager.delete_collection(user, coll)
            return {'deleted_id': coll}

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
        if not self.manager.has_collection(user):
            self._raise_error(404, 'Collection not found', api=True, id=coll)

