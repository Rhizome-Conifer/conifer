from webrecorder.basecontroller import BaseController
from bottle import request


# ============================================================================
class ListsController(BaseController):
    def init_routes(self):
        # LISTS
        @self.app.get('/api/v1/lists')
        def get_lists():
            user, collection = self.load_user_coll()

            with_bookmarks = True
            if request.query.include_bookmarks:
                with_bookmarks = request.query.include_bookmarks == 'true'

            lists = collection.get_lists()

            return {
                'lists': [blist.serialize(include_bookmarks=with_bookmarks)
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

            return {'list': blist.serialize()}

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
                return {'error': 'error deleting: ' + list_id}

        @self.app.post('/api/v1/list/<list_id>/move')
        def move_list_before(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            before_id = request.json.get('before_id')

            if before_id:
                before = self.load_list(collection, before_id)
            else:
                before = None

            collection.move_list_before(blist, before)
            return {'success': 'list moved'}

        @self.app.post('/api/v1/lists/reorder')
        def reorder_lists():
            user, collection = self.load_user_coll()

            new_order = request.json.get('order', [])

            if collection.reorder_objects(new_order):
                return {'success': 'reordered'}
            else:
                return {'error': 'invalid order'}


        #BOOKMARKS
        @self.app.post('/api/v1/list/<list_id>/bookmarks')
        def create_bookmark(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            bookmark = blist.create_bookmark(request.json)

            return {'bookmark': bookmark.serialize()}

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

            return {'bookmarks': [bookmark.serialize() for bookmark in bookmarks]}

        @self.app.get('/api/v1/bookmark/<bid>')
        def get_bookmark(bid):
            blist, bookmark = self.load_list_bookmark(bid)

            return {'bookmark': bookmark.serialize()}

        @self.app.post('/api/v1/bookmark/<bid>')
        def update_bookmark(bid):
            blist, bookmark = self.load_list_bookmark(bid)

            bookmark.update(request.json)

            return {'bookmark': bookmark.serialize()}

        @self.app.delete('/api/v1/bookmark/<bid>')
        def delete_bookmark(bid):
            blist, bookmark = self.load_list_bookmark(bid)
            if blist.remove_bookmark(bookmark):
                return {'deleted_id': bid}
            else:
                return {'error': 'error deleting: ' + bid}

        @self.app.post('/api/v1/list/<list_id>/bookmarks/reorder')
        def reorder_bookmarks(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            new_order = request.json.get('order', [])

            if blist.reorder_objects(new_order):
                return {'success': 'reordered'}
            else:
                return {'error': 'invalid order'}

    def load_user_coll_list(self, list_id, user=None, coll_name=None):
        user, collection = self.load_user_coll(user=user, coll_name=coll_name)

        return user, collection, self.load_list(collection, list_id)

    def load_list(self, collection, list_id):
        blist = collection.get_list(list_id)
        if not blist:
            self._raise_error(404, 'List not found', api=True,
                              id=list_id)

        return blist

    def load_list_bookmark(self, bid, user=None, coll_name=None, list_id=None):
        if not list_id:
            list_id = request.query.getunicode('list')

        if not list_id:
            self._raise_error(400, 'list_id= must be specified', api=True)

        user, collection, blist = self.load_user_coll_list(list_id, user=user, coll_name=coll_name)

        bookmark = blist.get_bookmark(bid)
        if not bookmark:
            self._raise_error(404, 'Bookmark not found in list', api=True,
                              id=bid)

        return blist, bookmark

