from webrecorder.models.base import RedisUniqueComponent, RedisOrderedList
from webrecorder.utils import get_bool, redis_pipeline, get_new_id
from webrecorder.models.stats import Stats

import json


# ============================================================================
class BookmarkList(RedisUniqueComponent):
    MY_TYPE = 'blist'
    INFO_KEY = 'l:{blist}:info'
    ALL_KEYS = 'l:{blist}:*'

    ID_LEN = 8
    BOOK_ORDER_KEY = 'l:{blist}:o'
    BOOK_CONTENT_KEY = 'l:{blist}:b'

    BOOKMARK_COUNTER = 'l:{blist}:c'

    def __init__(self, **kwargs):
        super(BookmarkList, self).__init__(**kwargs)
        self.bookmark_order = RedisOrderedList(self.BOOK_ORDER_KEY, self)

    def init_new(self, collection, props):
        self.owner = collection

        list_id = self._create_new_id()

        key = self.INFO_KEY.format(blist=list_id)

        self.data = {'title': props['title'],
                     'desc': props.get('desc', ''),
                     'public': self._from_bool(props.get('public')),
                     'owner': self.owner.my_id,
                    }

        self._init_new()

        return list_id

    def create_bookmark(self, props, incr_stats=True):
        collection = self.get_owner()
        self.access.assert_can_write_coll(collection)

        # don't store rec id, if provided
        props.pop('rec', '')

        # if a page is specified for this bookmark, ensure that it has the same url and timestamp
        page_id = props.get('page_id')
        if page_id:
            if not collection.page_exists(page_id):
                return None

        bid = self.get_new_bookmark_id()
        props['id'] = bid

        bookmark = props

        self.bookmark_order.insert_ordered_id(bid, props.get('before_id'))

        self.redis.hset(self.BOOK_CONTENT_KEY.format(blist=self.my_id), bid, json.dumps(bookmark))

        if incr_stats:
            Stats(self.redis).incr_bookmark_add()

        if page_id:
            collection.clear_page_bookmark_cache()
            self.load_pages([bookmark])

        return bookmark

    def add_bookmarks(self, bookmarks):
        collection = self.get_owner()
        self.access.assert_can_write_coll(collection)

        all_bookmarks = {}

        clear_cache = False

        for bookmark_data in bookmarks:
            # don't store rec id, if provided
            bookmark_data.pop('rec', '')

            # if a page is specified for this bookmark, ensure that it has the same url and timestamp
            page_id = bookmark_data.get('page_id')
            if page_id:
                clear_cache = True

            bid = self.get_new_bookmark_id()
            bookmark_data['id'] = bid

            all_bookmarks[bid] = json.dumps(bookmark_data)

        self.bookmark_order.insert_ordered_ids(all_bookmarks.keys())

        self.redis.hmset(self.BOOK_CONTENT_KEY.format(blist=self.my_id), all_bookmarks)

        if clear_cache:
            self.get_owner().clear_page_bookmark_cache()

        Stats(self.redis).incr_bookmark_add(len(bookmarks))

        self.mark_updated()

    def get_bookmarks(self, load=True, start=0, end=-1, load_pages=True):
        self.access.assert_can_read_coll(self.get_owner())

        order = self.bookmark_order.get_ordered_keys(start, end)

        if order:
            bookmarks = self.redis.hmget(self.BOOK_CONTENT_KEY.format(blist=self.my_id), order)
        else:
            bookmarks = []

        bookmarks = [json.loads(bookmark) for bookmark in bookmarks]
        if not load_pages:
            return bookmarks

        return self.load_pages(bookmarks)

    def num_bookmarks(self):
        self.access.assert_can_read_coll(self.get_owner())

        return self.redis.hlen(self.BOOK_CONTENT_KEY.format(blist=self.my_id))

    def get_bookmark(self, bid):
        self.access.assert_can_read_coll(self.get_owner())

        bookmark = self.redis.hget(self.BOOK_CONTENT_KEY.format(blist=self.my_id), bid)

        if not bookmark:
            return None

        bookmark = json.loads(bookmark)
        self.load_pages([bookmark])
        return bookmark

    def update_bookmark(self, bid, props):
        self.access.assert_can_write_coll(self.get_owner())

        bookmark = self.get_bookmark(bid)

        if not bookmark:
            return False

        AVAIL_PROPS = ('title', 'url', 'timestamp', 'browser', 'desc')

        for prop in props:
            if prop in AVAIL_PROPS:
                bookmark[prop] = props[prop]

        self.redis.hset(self.BOOK_CONTENT_KEY.format(blist=self.my_id), bid, json.dumps(bookmark))

        Stats(self.redis).incr_bookmark_mod()

        return bookmark

    def remove_bookmark(self, bid):
        self.access.assert_can_write_coll(self.get_owner())

        res = self.bookmark_order.remove_ordered_id(bid)
        if not res:
            return False

        # check if bookmark had a page_id
        bookmark = self.get_bookmark(bid)
        page_id = bookmark.get('page_id')
        if page_id:
            #self.get_owner().remove_page_bookmark(page_id, bid)
            self.get_owner().clear_page_bookmark_cache()

        if self.redis.hdel(self.BOOK_CONTENT_KEY.format(blist=self.my_id), bid) == 1:
            Stats(self.redis).incr_bookmark_del()
            return True
        else:
            return False

    def reorder_bookmarks(self, new_order):
        return self.bookmark_order.reorder_objects(new_order)

    def serialize(self, include_bookmarks='all', convert_date=True, check_slug=None):
        data = super(BookmarkList, self).serialize(convert_date=convert_date)
        bookmarks = None

        if check_slug:
            data['slug_matched'] = (check_slug == data.get('slug'))

        # return all bookmarks with pages
        if include_bookmarks == 'all':
            bookmarks = self.get_bookmarks(load=True)
            data['bookmarks'] = bookmarks
            data['total_bookmarks'] = len(bookmarks)

        # returns all bookmarks without pages
        # remove ids that need not be serialized
        elif include_bookmarks == 'all-serialize':
            bookmarks = self.get_bookmarks(load=True, load_pages=False)
            for bookmark in bookmarks:
                bookmark.pop('id', '')
            data['bookmarks'] = bookmarks

            data.pop('owner', '')
            data.pop('timespan', '')
            data.pop('id', '')

        # return only first bookmark, set total_bookmarks
        elif include_bookmarks == 'first':
            bookmarks = self.get_bookmarks(load=True, start=0, end=0)
            data['bookmarks'] = bookmarks
            data['total_bookmarks'] = self.num_bookmarks()

        # else only return the number of bookmarks
        else:
            data['total_bookmarks'] = self.num_bookmarks()

        data['public'] = self.is_public()

        return data

    def load_pages(self, bookmarks):
        page_ids = []
        page_bookmarks = []

        for bookmark in bookmarks:
            page_id = bookmark.get('page_id')
            if page_id:
                page_ids.append(page_id)
                page_bookmarks.append(bookmark)

        if not page_ids:
            return bookmarks

        page_data_list = self.get_owner().get_pages_for_list(page_ids)

        for bookmark, page in zip(page_bookmarks, page_data_list):
            if page:
                bookmark['page'] = json.loads(page)
                bookmark['page']['id'] = bookmark['page_id']
            else:
                bookmark.pop('page_id', '')

        return bookmarks

    def update(self, props):
        self.access.assert_can_write_coll(self.get_owner())

        props = props or {}

        title = props.get('title')
        if title is not None:
            self.get_owner().update_list_slug(title, self)
            self.set_prop('title', title)

        public = props.get('public')
        if public is not None:
            self.set_public(public)

        desc = props.get('desc')
        if desc is not None:
            self.set_prop('desc', desc)

    def delete_me(self):
        self.access.assert_can_write_coll(self.get_owner())

        return self.delete_object()

    def get_new_bookmark_id(self):
        book_id = self.redis.incrby(self.BOOKMARK_COUNTER.format(blist=self.my_id))
        #return get_new_id(8)
        return str(book_id)

