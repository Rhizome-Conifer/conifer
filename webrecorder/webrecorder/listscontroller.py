from webrecorder.basecontroller import BaseController
from bottle import request, response

from webrecorder.utils import get_bool


# ============================================================================
class ListsController(BaseController):
    def init_routes(self):
        # LISTS
        @self.app.get('/api/v1/lists')
        def get_lists():
            user, collection = self.load_user_coll()

            include_bookmarks = request.query.include_bookmarks or 'all'

            lists = collection.get_lists()

            return {
                'lists': [blist.serialize(include_bookmarks=include_bookmarks)
                          for blist in lists]
            }

        @self.app.post('/api/v1/lists')
        def add_list():
            user, collection = self.load_user_coll()

            blist = collection.create_bookmark_list(request.json)

            return {'list': blist.serialize()}

        @self.app.get('/api/v1/list/<list_id>')
        def get_list(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            self.access.assert_can_read_list(blist)

            include_bookmarks = request.query.include_bookmarks or 'all'

            return {'list': blist.serialize(check_slug=list_id,
                                            include_bookmarks=include_bookmarks)}

        @self.app.post('/api/v1/list/<list_id>')
        def update_list(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            blist.update(request.json)

            return {'list': blist.serialize()}

        @self.app.delete('/api/v1/list/<list_id>')
        def delete_list(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            if collection.remove_list(blist):
                return {'deleted_id': list_id}
            else:
                self._raise_error(400, 'error_deleting')

        @self.app.post('/api/v1/list/<list_id>/move')
        def move_list_before(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            before_id = request.json.get('before_id')

            if before_id:
                before = self.load_list(collection, before_id)
            else:
                before = None

            collection.move_list_before(blist, before)
            return {'success': 'list_moved'}

        @self.app.post('/api/v1/lists/reorder')
        def reorder_lists():
            user, collection = self.load_user_coll()

            new_order = request.json.get('order', [])

            if collection.lists.reorder_objects(new_order):
                return {'success': 'reordered'}
            else:
                return self._raise_error(400, 'invalid_order')


        #BOOKMARKS
        @self.app.post('/api/v1/list/<list_id>/bookmarks')
        def create_bookmark(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            bookmark = blist.create_bookmark(request.json)
            if bookmark:
                return {'bookmark': bookmark}
            else:
                return self._raise_error(400, 'invalid_page')

        @self.app.post('/api/v1/list/<list_id>/bulk_bookmarks')
        def create_bookmarks(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            bookmark_list = request.json

            for bookmark_data in bookmark_list:
                bookmark = blist.create_bookmark(bookmark_data)

            return {'list': blist.serialize()}

        @self.app.get('/api/v1/list/<list_id>/bookmarks')
        def get_bookmarks(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            bookmarks = blist.get_bookmarks()

            return {'bookmarks': bookmarks}

        @self.app.get('/api/v1/bookmark/<bid>')
        def get_bookmark(bid):
            user, collection, blist = self.load_user_coll_list()

            bookmark = blist.get_bookmark(bid)
            return {'bookmark': bookmark}

        @self.app.post('/api/v1/bookmark/<bid>')
        def update_bookmark(bid):
            user, collection, blist = self.load_user_coll_list()

            bookmark = blist.update_bookmark(bid, request.json)

            return {'bookmark': bookmark}

        @self.app.delete('/api/v1/bookmark/<bid>')
        def delete_bookmark(bid):
            user, collection, blist = self.load_user_coll_list()
            if blist.remove_bookmark(bid):
                return {'deleted_id': bid}
            else:
                self._raise_error(404, 'no_such_bookmark')

        @self.app.post('/api/v1/list/<list_id>/bookmarks/reorder')
        def reorder_bookmarks(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            new_order = request.json.get('order', [])

            if blist.reorder_bookmarks(new_order):
                return {'success': 'reordered'}
            else:
                self._raise_error(400, 'invalid_order')

    def load_user_coll_list(self, list_id=None, user=None, coll_name=None):
        if not list_id:
            list_id = request.query.getunicode('list')

        if not list_id:
            self._raise_error(400, 'list_not_specified')

        user, collection = self.load_user_coll(user=user, coll_name=coll_name)

        return user, collection, self.load_list(collection, list_id)

    def load_list(self, collection, list_id):
        blist = collection.get_list_by_slug_or_id(list_id)
        if not blist:
            self._raise_error(404, 'no_such_list')

        return blist


