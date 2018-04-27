from webrecorder.models.base import RedisUniqueComponent, RedisOrderedList
from webrecorder.utils import get_bool


# ============================================================================
class BookmarkList(RedisUniqueComponent):
    MY_TYPE = 'blist'
    INFO_KEY = 'l:{blist}:info'
    ALL_KEYS = 'l:{blist}:*'

    BOOKMARKS_KEY = 'l:{blist}:bookmarks'

    def __init__(self, **kwargs):
        super(BookmarkList, self).__init__(**kwargs)
        self.bookmarks = RedisOrderedList(self.BOOKMARKS_KEY, self)

    def init_new(self, collection, props):
        self.owner = collection

        list_id = self._create_new_id()

        key = self.INFO_KEY.format(blist=list_id)

        self.data = {'title': props['title'],
                     'desc': props.get('desc', ''),
                     'public': self._from_bool(props.get('public')),
                     'owner': self.owner.my_id,
                    }

        self.name = str(list_id)
        self._init_new()

        return list_id

    def create_bookmark(self, props):
        collection = self.get_owner()
        self.access.assert_can_write_coll(collection)

        # if a page is specified for this bookmark, ensure that it has the same url and timestamp
        page_id = props.get('id')
        if page_id:
            if not collection.is_matching_page(page_id, props):
                return None

        bookmark = Bookmark(redis=self.redis,
                            access=self.access)

        bookmark.init_new(self, collection, props)

        before_bookmark = self.get_bookmark(props.get('before_id'))

        self.bookmarks.insert_ordered_object(bookmark, before_bookmark)

        return bookmark

    def get_bookmarks(self, load=True, start=0, end=-1):
        self.access.assert_can_read_coll(self.get_owner())

        return self.bookmarks.get_ordered_objects(Bookmark, load=load,
                                                  start=start, end=end)

    def num_bookmarks(self):
        self.access.assert_can_read_coll(self.get_owner())

        return self.bookmarks.num_ordered_objects()

    def get_bookmark(self, bid):
        self.access.assert_can_read_coll(self.get_owner())

        if bid is None or not self.bookmarks.contains_id(bid):
            return None

        bookmark = Bookmark(my_id=bid,
                            redis=self.redis,
                            access=self.access)

        bookmark.owner = self

        return bookmark

    def move_bookmark_before(self, bookmark, before_bookmark):
        self.access.assert_can_write_coll(self.get_owner())

        self.bookmarks.insert_ordered_object(bookmark, before_bookmark)

    def remove_bookmark(self, bookmark):
        self.access.assert_can_write_coll(self.get_owner())

        if not self.bookmarks.remove_ordered_object(bookmark):
            return False

        bookmark.delete_me()

        return True

    def serialize(self, include_bookmarks='all'):
        data = super(BookmarkList, self).serialize()
        bookmarks = None

        # return all bookmarks
        if include_bookmarks == 'all':
            bookmarks = self.get_bookmarks(load=True)
            data['bookmarks'] = [bookmark.serialize() for bookmark in bookmarks]
            data['total_bookmarks'] = len(bookmarks)

        # return only first bookmark, set total_bookmarks
        elif include_bookmarks == 'first':
            bookmarks = self.get_bookmarks(load=True, start=0, end=0)
            data['bookmarks'] = [bookmark.serialize() for bookmark in bookmarks]
            data['total_bookmarks'] = self.num_bookmarks()

        # else only return the number of bookmarks
        else:
            data['total_bookmarks'] = self.num_bookmarks()

        data['public'] = self.is_public()

        return data

    def update(self, props):
        self.access.assert_can_write_coll(self.get_owner())

        props = props or {}
        AVAIL_PROPS = ['title', 'desc', 'public']

        for prop in AVAIL_PROPS:
            if prop in props:
                value = props[prop]
                if prop == 'public':
                    self.set_public(value)
                else:
                    self.set_prop(prop, value)

    def delete_me(self):
        self.access.assert_can_write_coll(self.get_owner())

        for bookmark in self.get_bookmarks():
            bookmark.delete_me()

        return self.delete_object()


# ============================================================================
class Bookmark(RedisUniqueComponent):
    MY_TYPE = 'book'
    INFO_KEY = 'b:{book}:info'
    ALL_KEYS = 'b:{book}:*'

    def init_new(self, bookmark_list, collection, props):
        self.owner = bookmark_list

        bid = self._create_new_id()

        key = self.INFO_KEY.format(book=bid)

        self.data = {'url': props['url'],
                     'timestamp': props.get('timestamp', ''),
                     'title': props['title'],
                     'desc': props.get('desc', ''),
                     'state': '0',
                     'owner': self.owner.my_id,
                    }

        browser = props.get('browser')
        if browser:
            self.data['browser'] = browser

        page_id = props.get('id')
        if page_id:
            self.data['page'] = page_id

        self.name = str(bid)
        self._init_new()

        if page_id:
            collection.add_page_bookmark(page_id, self)

        return bid

    def update(self, props):
        self.access.assert_can_write_coll(self.owner.get_owner())

        props = props or {}
        AVAIL_PROPS = ['title', 'url', 'timestamp', 'browser', 'desc']

        for prop in AVAIL_PROPS:
            if prop in props:
                self.set_prop(prop, props[prop])

    def delete_me(self):
        self.access.assert_can_write_coll(self.owner.get_owner())

        page_id = self.get_prop('page_id')
        collection = self.get_collection()
        if collection:
            collection.remove_page_bookmark(page_id, self)

        return self.delete_object()

    def get_collection(self):
        bookmark_list = self.get_owner()
        if bookmark_list:
            return bookmark_list.get_owner()

        return None

    def serialize(self):
        data = super(Bookmark, self).serialize()

        if data.get('page'):
            collection = self.get_collection()
            if collection:
                data['page'] = collection.get_page(data['page'])

        return data


# ============================================================================
Bookmark.OWNER_CLS = BookmarkList

