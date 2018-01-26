import time

from webrecorder.utils import redis_pipeline

from webrecorder.models.base import RedisNamedContainer, BaseAccess

from webrecorder.models.collection import Collection


# ============================================================================
class User(RedisNamedContainer):
    MY_TYPE = 'user'
    INFO_KEY = 'u:{user}:info'
    ALL_KEYS = 'u:{user}:*'

    COMP_KEY = 'u:{user}:colls'

    DEFAULT_MAX_SIZE = 5000000

    def __init__(self, **kwargs):
        super(User, self).__init__(**kwargs)
        self.name = self.my_id

    def create_new_id(self):
        self.info_key = self.INFO_KEY.format_map({self.MY_TYPE: self.my_id})
        return self.my_id

    def create_collection(self, coll_name, **kwargs):
        #self.access.can_admin_coll(self)

        collection = Collection(redis=self.redis,
                                access=self.access)

        coll = collection.init_new(**kwargs)
        collection.name = coll_name
        collection.owner = self

        self.add_object(collection, owner=True)

        return collection

    def has_collection(self, coll_name):
        return self.name_to_id(coll_name) != None

    def get_collection_by_name(self, coll_name):
        coll = self.name_to_id(coll_name)
        if not coll:
            return None

        return self.get_collection_by_id(coll, coll_name)

    def get_collection_by_id(self, coll, coll_name):
        collection = Collection(my_id=coll,
                                name=coll_name,
                                redis=self.redis,
                                access=self.access)

        collection.owner = self
        #self.access.assert_can_read_coll(collection)
        return collection

    def get_collections(self, load=True):
        all_collections = self.get_objects(Collection)
        collections = []
        for collection in all_collections:
            collection.owner = self
            if self.access.can_read_coll(collection):
                if load:
                    collection.load()
                collections.append(collection)

        return collections

    def remove_collection(self, collection, delete=False):
        if not collection:
            return False

        if not self.remove_object(collection):
            return False

        if delete:
            return collection.delete_me()

        return True

    def delete_me(self):
        for collection in self.get_collections(load=False):
            collection.delete_me()

        return self.delete_object()

    def get_size_remaining(self):
        size, max_size = self.redis.hmget(self.info_key, ['size', 'max_size'])
        rem = 0

        try:
            if not size:
                size = 0

            if not max_size:
                max_size = self.DEFAULT_MAX_SIZE

            max_size = int(max_size)
            size = int(size)
            rem = max_size - size
        except Exception as e:
            raise
            print(e)

        return rem

    def is_out_of_space(self):
        self.access.assert_is_curr_user(self)

        return self.get_size_remaining() <= 0

    def is_anon(self):
        return self.name.startswith('temp-')

    def __eq__(self, obj):
        return obj and (self.my_id == obj.my_id) and type(obj) in (SessionUser, User)




# ============================================================================
class SessionUser(User):
    MAX_ANON_SIZE = 1000000000

    def __init__(self, **kwargs):
        self.sesh = kwargs['sesh']
        if self.sesh.curr_user:
            user = self.sesh.curr_user
            self.sesh_type = 'logged-in'

        elif self.sesh.is_anon():
            user = self.sesh.anon_user
            self.sesh_type = 'anon'

        else:
            user = self.sesh.anon_user
            self.sesh_type = 'transient'

        kwargs['access'] = BaseAccess()
        kwargs['my_id'] = user

        super(SessionUser, self).__init__(**kwargs)

        if kwargs.get('persist'):
            self._persist_anon_user()

    def _persist_anon_user(self):
        if self.sesh_type != 'transient':
            return False

        max_size = self.redis.hget('h:defaults', 'max_anon_size') or self.MAX_ANON_SIZE

        now = int(time.time())

        self.data = {'max_size': max_size,
                     'created_at': now,
                     'size': 0}

        with redis_pipeline(self.redis) as pi:
            self.commit(pi)

        self.sesh.set_anon()
        self.sesh_type == 'anon'
        return True

    def is_anon(self):
        if self.sesh_type == 'logged-in':
            return False

        return True

# ============================================================================
Collection.OWNER_CLS = User

