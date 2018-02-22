from webrecorder.models.base import RedisUniqueComponent


# ============================================================================
class BookmarkList(RedisUniqueComponent):
    MY_TYPE = 'blist'
    INFO_KEY = 'l:{blist}:info'
    ALL_KEYS = 'l:{blist}:*'

    COUNTER_KEY = 'c:{coll}:n:list_count'

    BOOKMARKS_KEY = 'l:{blist}:bookmarks'

    def __init__(self, **kwargs):
        super(BookmarkList, self).__init__(**kwargs)
        self.name = self.my_id

    def init_new(self, collection, title):
        self.owner = collection

        blist = self.create_new_id()

        key = self.INFO_KEY.format(blist=blist)

        self.data = {'title': title,
                     'owner': self.owner.my_id,
                    }

        self.name = str(blist)
        self._init_new()

        return blist

    def create_new_id(self):
        counter_key = self.COUNTER_KEY.format(coll=self.owner.my_id)
        self.my_id = self.redis.incr(counter_key)
        self.info_key = self.INFO_KEY.format_map({self.MY_TYPE: self.my_id})
        return self.my_id

    def add_bookmark(self, **kwargs):
        bookmark = Bookmark(redis=self.redis,
                            access=self.access)

        bid = bookmark.init_new(self, **kwargs)

        blist_key = self.BOOKMARKS_KEY.format(blist=blist)
        self.redis.rpush(blist_key, bid)

        return bookmark

    def delete_me(self):
        return self.delete_object()


# ============================================================================
class Bookmark(RedisUniqueComponent):
    MY_TYPE = 'book'
    INFO_KEY = 'b:{book}:info'
    ALL_KEYS = 'b:{book}:*'

    COUNTER_KEY = 'c:{coll}:n:bookmark_count'

    def init_new(self, bookmark_list, **kwargs):
        book = self.create_new_id()

        key = self.INFO_KEY.format(book=book)

        self.data = {'url': kwargs['url'],
                     'ts': kwargs['ts'],
                     'title': kwargs['title'],
                     'state': '0'
                    }

        browser = kwargs.get('browser')
        if browser:
            self.data['browser'] = browser

        self._init_new()

