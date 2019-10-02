from webrecorder.basecontroller import BaseController, wr_api_spec
from bottle import request, response

from webrecorder.utils import get_bool


# ============================================================================
class ListsController(BaseController):
    def init_routes(self):
        # LISTS
        wr_api_spec.set_curr_tag('Lists')

        @self.app.get('/api/v1/lists')
        @self.api(query=['user', 'coll', 'include_bookmarks'],
                  resp='lists')
        def get_lists():
            user, collection = self.load_user_coll()

            include_bookmarks = request.query.getunicode('include_bookmarks') or 'all'

            lists = collection.get_lists()

            return {
                'lists': [blist.serialize(include_bookmarks=include_bookmarks)
                          for blist in lists]
            }

        @self.app.post('/api/v1/lists')
        @self.api(query=['user', 'coll', 'include_bookmarks'],
                  req_desc='List properties',
                  req=['title', 'desc', 'public', 'before_id'],
                  resp='list')
        def add_list():
            user, collection = self.load_user_coll()

            blist = collection.create_bookmark_list(request.json)

            collection.mark_updated()

            return {'list': blist.serialize()}

        @self.app.get('/api/v1/list/<list_id>')
        @self.api(query=['user', 'coll', 'include_bookmarks'],
                  resp='list')
        def get_list(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            self.access.assert_can_read_list(blist)

            include_bookmarks = request.query.getunicode('include_bookmarks') or 'all'

            return {'list': blist.serialize(check_slug=list_id,
                                            include_bookmarks=include_bookmarks)}

        @self.app.post('/api/v1/list/<list_id>')
        @self.api(query=['user', 'coll'],
                  req_desc='Update List properties',
                  req=['title', 'desc', 'public'],
                  resp='list')
        def update_list(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            blist.update(request.json)

            blist.mark_updated()
            return {'list': blist.serialize()}

        @self.app.delete('/api/v1/list/<list_id>')
        @self.api(query=['user', 'coll'],
                  resp='deleted')
        def delete_list(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            if collection.remove_list(blist):
                collection.mark_updated()
                return {'deleted_id': list_id}
            else:
                self._raise_error(400, 'error_deleting')

        @self.app.post('/api/v1/list/<list_id>/move')
        @self.api(query=['user', 'coll'],
                  req=['before_id'],
                  resp='success')
        def move_list_before(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            before_id = request.json.get('before_id')

            if before_id:
                before = self.load_list(collection, before_id)
            else:
                before = None

            blist.mark_updated()
            collection.move_list_before(blist, before)
            return {'success': True}

        @self.app.post('/api/v1/lists/reorder')
        @self.api(query=['user', 'coll'],
                  req_desc='An array of existing list ids in a new order',
                  req=['order'],
                  resp='success')
        def reorder_lists():
            user, collection = self.load_user_coll()

            new_order = request.json.get('order', [])

            if collection.lists.reorder_objects(new_order):
                collection.mark_updated()
                return {'success': True}
            else:
                return self._raise_error(400, 'invalid_order')


        #BOOKMARKS
        wr_api_spec.set_curr_tag('Bookmarks')

        @self.app.post('/api/v1/list/<list_id>/bookmarks')
        @self.api(query=['user', 'coll'],
                  req_desc='Bookmark properties',
                  req=['title', 'url', 'timestamp', 'browser', 'desc', 'page_id', 'before_id'],
                  resp='bookmark')
        def create_bookmark(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            bookmark = blist.create_bookmark(request.json)
            if bookmark:
                blist.mark_updated()
                return {'bookmark': bookmark}
            else:
                return self._raise_error(400, 'invalid_page')

        @self.app.post('/api/v1/list/<list_id>/bulk_bookmarks')
        @self.api(query=['user', 'coll'],
                  req_desc='List of Bookmarks',
                  req={'type': 'array', 'item_type': ['title', 'url', 'timestamp', 'browser', 'desc', 'page_id', 'before_id']},
                  resp='list')
        def create_bookmarks(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            bookmark_list = request.json

            blist.add_bookmarks(bookmark_list)

            return {'success': True}

        @self.app.get('/api/v1/list/<list_id>/bookmarks')
        @self.api(query=['user', 'coll'],
                  resp='bookmarks')
        def get_bookmarks(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            bookmarks = blist.get_bookmarks()

            return {'bookmarks': bookmarks}

        @self.app.get('/api/v1/bookmark/<bid>')
        @self.api(query=['user', 'coll', 'list'],
                  resp='bookmark')
        def get_bookmark(bid):
            user, collection, blist = self.load_user_coll_list()

            bookmark = blist.get_bookmark(bid)
            return {'bookmark': bookmark}

        @self.app.post('/api/v1/bookmark/<bid>')
        @self.api(query=['user', 'coll', 'list'],
                  req_desc='Bookmark properties',
                  req=['title', 'url', 'timestamp', 'browser', 'desc', 'page_id', 'before_id'],
                  resp='bookmark')
        def update_bookmark(bid):
            user, collection, blist = self.load_user_coll_list()

            bookmark = blist.update_bookmark(bid, request.json)

            blist.mark_updated()
            return {'bookmark': bookmark}

        @self.app.delete('/api/v1/bookmark/<bid>')
        @self.api(query=['user', 'coll', 'list'],
                  resp='deleted')
        def delete_bookmark(bid):
            user, collection, blist = self.load_user_coll_list()
            if blist.remove_bookmark(bid):
                blist.mark_updated()
                return {'deleted_id': bid}
            else:
                self._raise_error(404, 'no_such_bookmark')

        @self.app.post('/api/v1/list/<list_id>/bookmarks/reorder')
        @self.api(query=['user', 'coll'],
                  req_desc='An array of existing bookmark ids in a new order',
                  req=['order'],
                  resp='success')
        def reorder_bookmarks(list_id):
            user, collection, blist = self.load_user_coll_list(list_id)

            new_order = request.json.get('order', [])

            if blist.reorder_bookmarks(new_order):
                blist.mark_updated()
                return {'success': True}
            else:
                self._raise_error(400, 'invalid_order')

        wr_api_spec.set_curr_tag(None)

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


