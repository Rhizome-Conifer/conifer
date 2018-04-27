from webrecorder.models.base import RedisUniqueComponent, RedisUnorderedList


# ============================================================================
class Page(RedisUniqueComponent):
    MY_TYPE = 'page'
    INFO_KEY = 'p:{page}:info'
    ALL_KEYS = 'p:{page}:*'

    BOOK_REF_KEY = 'p:{page}:b'

    SERIALIZE_LIST = ['url', 'timestamp', 'title', 'browser', 'rec']

    AVAIL_PROPS = ['url', 'timestamp', 'title', 'browser']

    def __init__(self, **kwargs):
        super(Page, self).__init__(**kwargs)
        self.ref_bookmarks = RedisUnorderedList(self.BOOK_REF_KEY, self)

    def init_new(self, collection, recording, props):
        self.owner = collection

        pid = self._create_new_id()

        key = self.INFO_KEY.format(page=pid)

        self.data = {
                     'url': props['url'],
                     'timestamp': props.get('timestamp', ''),
                     'title': props['title'],
                     'owner': self.owner.my_id,
                     'rec': recording.my_id,
                    }

        if props.get('browser'):
            self.data['browser'] = props.get('browser')

        self.name = str(pid)
        self._init_new()

    def update(self, props):
        self.access.assert_can_write_coll(self.get_owner())

        props = props or {}

        for prop in self.AVAIL_PROPS:
            if prop in props:
                self.set_prop(prop, props[prop])

    def delete_me(self):
        self.access.assert_can_write_coll(self.get_owner())

        return self.delete_object()

    def load(self, partial=True):
        if not partial:
            super(Page, self).load()

        data_list = self.redis.hmget(self.info_key, self.SERIALIZE_LIST)
        self.data = {key: value for key, value in zip(self.SERIALIZE_LIST, data_list)}
        self.loaded = True

    def serialize(self):
        if not self.loaded:
            self.load()

        if not self.data.get('browser'):
            self.data.pop('browser')

        self.data['id'] = self.my_id

        return self.data

