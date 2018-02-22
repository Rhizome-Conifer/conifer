from webrecorder.basecontroller import BaseController
from bottle import request


# ============================================================================
class ListsController(BaseController):
    def init_routes(self):
        @self.app.get('/api/v1/lists')
        def get_lists():
            user, collection = self.load_user_coll()

            lists = collection.get_lists()

            return {'lists': [blist.serialize() for blist in lists]}

        @self.app.post('/api/v1/lists')
        def add_list():
            user, collection = self.load_user_coll()

            blist = collection.create_bookmark_list(request.json['title'])

            return {'list': blist.serialize()}

        @self.app.get('/api/v1/list/<blist_id>')
        def get_list(blist_id):
            user, collection, blist = self.load_user_coll_list(blist_id)

            return {'list': blist.serialize()}

        @self.app.delete('/api/v1/list/<blist_id>')
        def delete_list(blist_id):
            user, collection, blist = self.load_user_coll_list(blist_id)

            if collection.remove_list(blist):
                return {'delete_id': blist_id}
            else:
                return {'error': 'error deleting: ' + blist_id}

        @self.app.post('/api/v1/list/<blist_id>/move-before')
        def move_list_before(blist_id):
            user, collection, blist = self.load_user_coll_list(blist_id)

            before_id = request.json.get('before_id')

            if before_id:
                before = self.load_list(collection, before_id)
            else:
                before = None

            collection.move_list_before(blist, before)
            return {'success': 'list moved'}

        @self.app.post('/api/v1/list/<blist_id>')
        def update_list(blist_id):
            user, collection, blist = self.load_user_coll_list(blist_id)

            new_title = request.json.get('title')
            blist['title'] = new_title

            return {'list': blist.serialize()}

    def load_user_coll_list(self, blist_id, user=None, coll_name=None):
        user, collection = self.load_user_coll(user=user, coll_name=coll_name)

        return user, collection, self.load_list(collection, blist_id)

    def load_list(self, collection, blist_id):
        blist = collection.get_list(blist_id)
        if not blist:
            self._raise_error(404, 'List not found', api=True,
                              id=blist_id)

        return blist
