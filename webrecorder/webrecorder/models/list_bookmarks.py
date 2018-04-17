from webrecorder.models.base import RedisUniqueComponent, RedisOrderedListMixin
from webrecorder.utils import get_bool


# ============================================================================
class BookmarkList(RedisOrderedListMixin, RedisUniqueComponent):
    MY_TYPE = 'blist'
    INFO_KEY = 'l:{blist}:info'
    ALL_KEYS = 'l:{blist}:*'

    ORDERED_LIST_KEY = 'l:{blist}:bookmarks'

    COUNTER_KEY = 'n:lists:count'

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
        self.access.assert_can_write_coll(self.get_owner())

        bookmark = Bookmark(redis=self.redis,
                            access=self.access)

        bookmark.init_new(self, props)

        before_bookmark = self.get_bookmark(props.get('before_id'))

        self.insert_ordered_object(bookmark, before_bookmark)

        return bookmark

    def get_bookmarks(self, load=True):
        self.access.assert_can_read_coll(self.get_owner())

        return self.get_ordered_objects(Bookmark, load=load)

    def num_bookmarks(self):
        self.access.assert_can_read_coll(self.get_owner())

        return self.num_ordered_objects()

    def get_bookmark(self, bid):
        self.access.assert_can_read_coll(self.get_owner())

        if bid is None or not self.contains_id(bid):
            return None

        bookmark = Bookmark(my_id=bid,
                            redis=self.redis,
                            access=self.access)

        bookmark.owner = self

        return bookmark

    def move_bookmark_before(self, bookmark, before_bookmark):
        self.access.assert_can_write_coll(self.get_owner())

        self.insert_ordered_object(bookmark, before_bookmark)

    def remove_bookmark(self, bookmark):
        self.access.assert_can_write_coll(self.get_owner())

        if not self.remove_ordered_object(bookmark):
            return False

        bookmark.delete_me()

        return True

    def serialize(self, include_bookmarks=True):
        data = super(BookmarkList, self).serialize()

        if include_bookmarks:
            bookmarks = self.get_bookmarks(load=True)
            data['bookmarks'] = [bookmark.serialize() for bookmark in bookmarks]
        else:
            data['num_bookmarks'] = self.num_bookmarks()

        data['public'] = get_bool(data['public'])

        return data

    def update(self, props):
        self.access.assert_can_write_coll(self.get_owner())

        props = props or {}
        AVAIL_PROPS = ['title', 'desc', 'public']

        for prop in AVAIL_PROPS:
            if prop in props:
                value = props[prop]
                if prop == 'public':
                    value = self._from_bool(value)
                self.set_prop(prop, value)

    @classmethod
    def _from_bool(self, value):
        return '1' if value else '0'

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

    COUNTER_KEY = 'n:bookmarks:count'

    def init_new(self, bookmark_list, props):
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

        self.name = str(bid)
        self._init_new()

    def update(self, props):
        self.access.assert_can_write_coll(self.owner.get_owner())

        props = props or {}
        AVAIL_PROPS = ['title', 'url', 'timestamp', 'browser', 'desc']

        for prop in AVAIL_PROPS:
            if prop in props:
                self.set_prop(prop, props[prop])

    def delete_me(self):
        self.access.assert_can_write_coll(self.owner.get_owner())

        return self.delete_object()


# ============================================================================
Bookmark.OWNER_CLS = BookmarkList

