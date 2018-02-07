import time
import os
import datetime

from webrecorder.utils import redis_pipeline

from webrecorder.models.base import RedisNamedContainer

from webrecorder.models.collection import Collection


# ============================================================================
class User(RedisNamedContainer):
    MY_TYPE = 'user'
    INFO_KEY = 'u:{user}:info'
    ALL_KEYS = 'u:{user}:*'

    COMP_KEY = 'u:{user}:colls'

    MAX_ANON_SIZE = 1000000000
    MAX_USER_SIZE = 5000000000

    RATE_LIMIT_KEY = 'ipr:{ip}:{H}'

    URL_SKIP_KEY = 'us:{user}:s:{url}'
    SKIP_KEY_SECS = 330

    @classmethod
    def init_props(cls, config):
        cls.MAX_USER_SIZE = int(config['default_max_size'])
        cls.MAX_ANON_SIZE = int(config['default_max_anon_size'])

        cls.rate_limit_max = int(os.environ.get('RATE_LIMIT_MAX', 0))
        cls.rate_limit_hours = int(os.environ.get('RATE_LIMIT_HOURS', 0))
        cls.rate_limit_restricted_max = int(os.environ.get('RATE_LIMIT_RESTRICTED_MAX', cls.rate_limit_max))
        cls.rate_limit_restricted_hours = int(os.environ.get('RATE_LIMIT_RESTRICTED_HOURS', cls.rate_limit_hours))

        cls.rate_restricted_ips = os.environ.get('RATE_LIMIT_RESTRICTED_IPS', '').split(',')

        cls.URL_SKIP_KEY = config['skip_key_templ']
        cls.SKIP_KEY_SECS = int(config['skip_key_secs'])

    def __init__(self, **kwargs):
        super(User, self).__init__(**kwargs)
        self.name = self.my_id

    def create_new(self):
        max_size = self.redis.hget('h:defaults', 'max_size')
        if not max_size:
            max_size = self.MAX_USER_SIZE

        self._init_new(max_size)

    def _init_new(self, max_size):
        now = int(time.time())

        self.data = {'max_size': max_size,
                     'created_at': now,
                     'size': 0}

        with redis_pipeline(self.redis) as pi:
            self.commit(pi)

    def create_new_id(self):
        self.info_key = self.INFO_KEY.format_map({self.MY_TYPE: self.my_id})
        return self.my_id

    def create_collection(self, coll_name, **kwargs):
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

        return self.get_collection_by_id(coll, coll_name)

    def get_collection_by_id(self, coll, coll_name):
        if not coll:
            return None

        collection = Collection(my_id=coll,
                                name=coll_name,
                                redis=self.redis,
                                access=self.access)

        collection.owner = self
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

    def num_collections(self):
        return self.num_objects()

    def move(self, collection, new_name, new_user):
        if not self.rename(collection, new_name, new_user):
            return False

        for recording in collection.get_recordings():
            recording.move_warcs(new_user)

        return True

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

    def get_size_allotment(self):
        max_size = self.redis.hmget(self.info_key, 'max_size')

        if max_size:
            return int(max_size[0])

        return self.MAX_USER_SIZE

    def get_size_remaining(self):
        size, max_size = self.redis.hmget(self.info_key, ['size', 'max_size'])
        rem = 0

        try:
            if not size:
                size = 0

            if not max_size:
                max_size = self.MAX_USER_SIZE

            max_size = int(max_size)
            size = int(size)
            rem = max_size - size
        except Exception as e:
            print(e)

        return rem

    def is_out_of_space(self):
        self.access.assert_is_curr_user(self)

        return self.get_size_remaining() <= 0

    def mark_skip_url(self, url):
        key = self.URL_SKIP_KEY.format(user=self.my_id,  url=url)
        r = self.redis.setex(key, self.SKIP_KEY_SECS, 1)

    def is_anon(self):
        return self.name.startswith('temp-')

    def __eq__(self, obj):
        if obj and (self.my_id == obj.my_id) and type(obj) in (SessionUser, User):
            return True
        else:
            return False

    def is_rate_limited(self, ip):
        if not self.rate_limit_hours or not self.rate_limit_max:
            return False

        if self.access.is_superuser():
            return False

        rate_key = self.RATE_LIMIT_KEY.format(ip=ip, H='')
        h = int(datetime.datetime.utcnow().strftime('%H'))

        if ip in self.rate_restricted_ips:
            limit_hours = self.rate_limit_restricted_hours
            limit_max = self.rate_limit_restricted_max
        else:
            limit_hours = self.rate_limit_hours
            limit_max = self.rate_limit_max

        rate_keys = [rate_key + '%02d' % ((h - i) % 24)
                     for i in range(0, limit_hours)]

        values = self.redis.mget(rate_keys)
        total = sum(int(v) for v in values if v)

        return (total >= limit_max)


# ============================================================================
class SessionUser(User):
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

        kwargs['my_id'] = user

        super(SessionUser, self).__init__(**kwargs)

        if kwargs.get('persist'):
            self._persist_anon_user()

    def num_collections(self):
        if self.sesh_type == 'logged-in':
            return super(SessionUser, self).num_collections()

        elif self.sesh_type == 'anon':
            return 1

        else:
            return 0

    def _persist_anon_user(self):
        if self.sesh_type != 'transient':
            return False

        max_size = self.redis.hget('h:defaults', 'max_anon_size') or self.MAX_ANON_SIZE

        self._init_new(max_size=max_size)

        self.sesh.set_anon()
        self.sesh_type == 'anon'
        return True

    def is_anon(self):
        if self.sesh_type == 'logged-in':
            return False

        return True


# ============================================================================
Collection.OWNER_CLS = User


# ============================================================================
class UserTable(object):
    def __init__(self, redis, users_key, access):
        self.redis = redis
        self.iteritems = self.items
        self.users_key = users_key
        self.access = access

    def get_user(self, name):
        return LoginUser(my_id=name,
                         redis=self.redis,
                         access=self.access)

    def __contains__(self, name):
        return self.redis.sismember(self.users_key, name)

    def __setitem__(self, name, values):
        if isinstance(values, dict):
            user = self.get_user(name)
            user.data.update(values)

            with redis_pipeline(self.redis) as pi:
                user.commit(pi)
                pi.sadd(self.users_key, name)

        elif not isinstance(values, User):
            raise Exception('invalid values')

    def __delitem__(self, name):
        user = self.get_user(name)
        user.delete_me()

        self.redis.srem(self.users_key, name)

    def __getitem__(self, name):
        return self.get_user(name)

    def __iter__(self):
        keys = self.redis.smembers(self.users_key)
        return iter(keys)

    def items(self):
        for key in self:
            user = self.get_user(key)
            yield user.name, user


# ============================================================================
class LoginUser(User):
    def __getitem__(self, name):
        return self.get_prop(name)

    def __setitem__(self, name, value):
        self.set_prop(name, value)

    def get(self, name, default_val=''):
        return self.get_prop(name, default_val)

