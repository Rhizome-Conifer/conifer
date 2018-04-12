import os
import datetime
import json
import time

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

    def create_new(self):
        max_size = self.redis.hget('h:defaults', 'max_size')
        if not max_size:
            max_size = self.MAX_USER_SIZE

        self.init_new(max_size)

    def init_new(self, max_size):
        self.data = {'max_size': max_size,
                     'size': 0}

        self._init_new()

    def _create_new_id(self):
        self.info_key = self.INFO_KEY.format_map({self.MY_TYPE: self.my_id})
        return self.my_id

    def create_collection(self, coll_name, allow_dupe=False, **kwargs):
        coll_name = self.reserve_obj_name(coll_name, allow_dupe=allow_dupe)

        collection = Collection(redis=self.redis,
                                access=self.access)

        coll = collection.init_new(**kwargs)

        self.add_object(coll_name, collection, owner=True)

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
            if not recording.queue_move_warcs(new_user):
                return False

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

        if max_size and max_size[0]:
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

    def serialize(self, compute_size_allotment=False,
                  include_colls=False,
                  include_recordings=False,
                  include_lists=False):

        data = super(User, self).serialize()

        # assemble space usage
        if compute_size_allotment:
            total = self.get_size_allotment()
            avail = self.get_size_remaining()
            data['space_utilization'] = {
                'total': total,
                'used': total - avail,
                'available': avail,
            }

        if include_colls:
            colls = self.get_collections()
            data['collections'] = [coll.serialize(
                                    include_recordings=include_recordings,
                                    include_lists=include_lists) for coll in colls]

        data['username'] = self.name

        if self.is_anon():
            data['ttl'] = self.access.get_anon_ttl()
            collection = self.get_collection_by_name('temp')
            if collection:
                data['rec_count'] = collection.num_recordings()

        else:
            data['email'] = data.pop('email_addr')
            #desc_data = json.loads(data.pop('desc', '{}'))
            #data['name'] = desc_data.get('name', '')
            data['name'] = data.pop('name', '')
            last_login = data.get('last_login')
            if last_login:
                data['last_login'] = self.to_iso_date(last_login)

        return data

    def update_last_login(self):
        self.set_prop('last_login', int(time.time()))

    def __eq__(self, obj):
        if obj and (self.my_id == obj.my_id) and isinstance(obj, User):
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

    def get_user_temp_warc_path(self):
        return os.path.join(os.environ['RECORD_ROOT'], self.name)


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

    @property
    def curr_role(self):
        if self.sesh_type == 'anon':
            return 'anon'
        elif self.sesh_type == 'transient':
            return None
        else:
            return self['role']

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

        self.init_new(max_size=max_size)

        self.sesh.set_anon()
        self.sesh_type = 'anon'
        return True

    def is_anon(self):
        if self.sesh_type == 'logged-in':
            return False

        return True


# ============================================================================
class UserTable(object):
    USERS_KEY = 's:users'

    def __init__(self, redis, access_func, users_key=''):
        self.redis = redis
        self.access_func = access_func
        self.users_key = users_key or self.USERS_KEY

    def get_user(self, name):
        return User(my_id=name,
                    redis=self.redis,
                    access=self.access_func())

    def __contains__(self, name):
        return self.redis.sismember(self.users_key, name)

    def __setitem__(self, name, obj):
        if isinstance(obj, dict):
            user = self.get_user(name)
            user.access.assert_is_curr_user(user)
            user.data.update(obj)

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
        user = self.get_user(name)
        if not self.redis.sismember(self.users_key, name):
            if not user.is_anon():
                raise Exception('No Such User: ' + name)

        return user

    def __iter__(self):
        keys = self.redis.smembers(self.users_key)
        return iter(keys)

    def __len__(self):
        return self.redis.scard(self.users_key)

    def items(self):
        for key in self:
            user = self.get_user(key)
            yield user.name, user

    iteritems = items


# ============================================================================
Collection.OWNER_CLS = User


