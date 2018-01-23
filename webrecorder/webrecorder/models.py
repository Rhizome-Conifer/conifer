import json
import time

from webrecorder.utils import redis_pipeline
from six.moves.urllib.parse import urlsplit


# ============================================================================
class RedisUniqueComponent(object):
    INT_KEYS = ('size', 'created_at', 'updated_at')

    COUNTER_KEY = None
    INFO_KEY = ''
    MY_TYPE = ''

    ALL_KEYS = ''

    def __init__(self, **kwargs):
        self.redis = kwargs['redis']
        self.my_id = kwargs.get('my_id', '')
        self.name = kwargs.get('name', '')

        if self.my_id:
            self.info_key = self.INFO_KEY.format_map({self.MY_TYPE: self.my_id})
        else:
            self.info_key = None

        if kwargs.get('load'):
            self.load()
        else:
            self.data = {}
            self.loaded = False

    @property
    def size(self):
        return self.get_prop('size', int)

    def incr_size(self, size):
        val = self.redis.hincrby(self.info_key, 'size', size)
        self.data['size'] = int(val)

    def load(self):
        self.data = self.redis.hgetall(self.info_key)
        self._format_keys()
        self.loaded = True

    def _format_keys(self):
        for key in self.INT_KEYS:
            if key in self.data:
                self.data[key] = int(self.data[key])

    def create_new_id(self):
        self.my_id = self.redis.incr(self.COUNTER_KEY)
        self.info_key = self.INFO_KEY.format_map({self.MY_TYPE: self.my_id})
        return self.my_id

    def commit(self, pi=None):
        pi = pi or self.redis
        pi.hmset(self.info_key, self.data)

    def serialize(self):
        if not self.loaded:
            self.load()

        self.data['id'] = self.name
        return self.data

    def get_prop(self, attr, force_type=None):
        if not self.loaded:
            if attr not in self.data:
                self.data[attr] = self.redis.hget(self.info_key, attr)
                if force_type:
                    self.data[attr] = force_type(self.data[attr])

        return self.data.get(attr)

    def set_prop(self, attr, value):
        self.data[attr] = value
        self.redis.hset(self.info_key, attr, value)

    def delete_object(self):
        deleted = False

        all_keys = self.ALL_KEYS.format_map({self.MY_TYPE: self.my_id})

        for key in self.redis.scan_iter(all_keys, count=100):
            self.redis.delete(key)
            deleted = True

        return deleted


# ============================================================================
class RedisNamedContainer(RedisUniqueComponent):
    def remove_object(self, obj):
        if not obj:
            return 0

        comp_map = self.get_comp_map()
        res = self.redis.hdel(comp_map, obj.name)

        self.incr_size(-obj.size)
        return res

    def add_object(self, obj, owner=False):
        dupe_count = 1
        name = obj.name

        comp_map = self.get_comp_map()

        while True:
            if self.redis.hsetnx(comp_map, name, obj.my_id) == 1:
                break

            dupe_count += 1
            dupe_str = str(dupe_count)
            name = obj.name + '-' + dupe_str

        self.incr_size(obj.size)
        obj.name = name
        if owner:
            obj.set_prop('owner', self.my_id)
        return name

    def get_comp_map(self):
        return self.COMP_KEY.format_map({self.MY_TYPE: self.my_id})

    def name_to_id(self, obj_name):
        comp_map = self.get_comp_map()

        return self.redis.hget(comp_map, obj_name)

    def rename(self, obj, new_name, new_cont=None):
        if not self.remove_object(obj):
            return None

        obj.name = new_name
        new_cont = new_cont or self
        return new_cont.add_object(obj)

    def get_objects(self, cls, load=True):
        all_objs = self.redis.hgetall(self.get_comp_map())
        obj_list = [cls(my_id=val,
                        name=name,
                        redis=self.redis,
                        load=True) for name, val in all_objs.items()]

        return obj_list


# ============================================================================
class Recording(RedisUniqueComponent):
    MY_TYPE = 'rec'
    INFO_KEY = 'r:{rec}:info'
    ALL_KEYS = 'r:{rec}:*'

    COUNTER_KEY = 'n:recs:count'

    OPEN_REC_KEY = 'r:{rec}:open'

    PAGE_KEY = 'r:{rec}:page'

    RA_KEY = 'r:{rec}:ra'

    WARC_KEY = 'r:{rec}:warc'

    DEL_Q = 'q:del:{target}'

    OPEN_REC_TTL = 5400

    def init_new(self, title, rec_type=None, ra_list=None):
        rec = self.create_new_id()

        open_rec_key = self.OPEN_REC_KEY.format(rec=rec)

        now = int(time.time())

        self.data = {'title': title,
                     'created_at': now,
                     'updated_at': now,
                     'size': 0,
                    }

        if rec_type:
            self.data['rec_type'] = rec_type

        with redis_pipeline(self.redis) as pi:
            self.commit(pi)

            if ra_list:
                pi.sadd(self.RA_KEY, *ra_list)

            #TODO
            pi.setex(open_rec_key, self.OPEN_REC_TTL, 1)

        return rec

    def get_owner_collection(self):
        owner_id = self.get_prop('owner')
        if not owner_id:
            return None

        return Collection(my_id=owner_id,
                          redis=self.redis)

    def serialize(self):
        data = super(Recording, self).serialize()

        # add any remote archive sources
        sources_key = self.RA_KEY.format(rec=self.my_id)
        data['ra_sources'] = list(self.redis.smembers(sources_key))

        return data

    def delete_me(self):
        self.delete_warcs()

        return self.delete_object()

    def delete_warcs(self):
        warc_key = self.WARC_KEY.format(rec=self.my_id)

        all_warcs = self.redis.hgetall(warc_key)

        with redis_pipeline(self.redis) as pi:
            for n, v in all_warcs.items():
                parts = urlsplit(v)
                if parts.scheme == 'http':
                    target = parts.netloc
                elif parts.scheme:
                    target = parts.scheme
                else:
                    target = 'nginx'

                pi.rpush(self.DEL_Q.format(target=target), v)

            pi.delete(warc_key)


# ============================================================================
class Collection(RedisNamedContainer):
    MY_TYPE = 'coll'
    INFO_KEY = 'c:{coll}:info'
    ALL_KEYS = 'c:{coll}:*'

    COUNTER_KEY = 'n:colls:count'

    COMP_KEY = 'c:{coll}:recs'

    def create_recording(self, rec_name, **kwargs):
        recording = Recording(redis=self.redis)

        rec = recording.init_new(**kwargs)
        recording.name = rec_name

        self.add_object(recording, owner=True)

        return recording

    def init_new(self, title, desc='', public=False):
        coll = self.create_new_id()

        key = self.INFO_KEY.format(coll=coll)

        now = int(time.time())

        self.data = {'title': title,
                     'created_at': now,
                     'updated_at': now,
                     'size': 0,
                     'desc': desc,
                    }

        with redis_pipeline(self.redis) as pi:
            self.commit(pi)

        return coll

    def get_owner_user(self):
        owner_id = self.get_prop('owner')
        if not owner_id:
            return None

        return User(my_id=owner_id,
                    redis=self.redis)

    def get_recording_by_name(self, rec_name):
        rec = self.name_to_id(rec_name)
        if not rec:
            return None

        return Recording(my_id=rec,
                         name=rec_name,
                         redis=self.redis)

    def get_recordings(self, load=True):
        return self.get_objects(Recording, load=load)

    def remove_recording(self, recording, user, delete=False, many=False):
        if not recording:
            return False

        #if not many:
        #    self.assert_can_admin(user, coll)

        if not self.remove_object(recording):
            return False

        size = recording.size
        if user:
            user.incr_size(-recording.size)

        if delete:
            return recording.delete_me()

        #if not many:
        #    self.sync_coll_index(user, coll, exists=True, do_async=True)
        return True

    def delete_me(self):
        all_objs = self.redis.hgetall(self.get_comp_map())

        for recording in self.get_recordings(load=False):
            recording.delete_me()

        return self.delete_object()


# ============================================================================
class User(RedisNamedContainer):
    MY_TYPE = 'user'
    INFO_KEY = 'u:{user}:info'
    ALL_KEYS = 'u:{user}:*'

    COMP_KEY = 'u:{user}:colls'

    def __init__(self, **kwargs):
        super(User, self).__init__(**kwargs)
        self.name = self.my_id

    def create_collection(self, coll_name, **kwargs):
        collection = Collection(redis=self.redis)

        coll = collection.init_new(**kwargs)
        collection.name = coll_name

        self.add_object(collection, owner=True)

        return collection

    def get_collection_by_name(self, coll_name):
        coll = self.name_to_id(coll_name)
        if not coll:
            return None

        return Collection(my_id=coll,
                          name=coll_name,
                          redis=self.redis)

    def get_collections(self, load=True):
        return self.get_objects(Collection, load=load)

    def remove_collection(self, collection, delete=False):
        if not collection:
            return False

        if not self.remove_object(collection):
            return False

        if delete:
            return collection.delete_me()

        return True

    def delete_me(self):
        try:
            for collection in self.get_collections(load=False):
                collection.delete_me()

            return self.delete_object()
        except:
            import traceback
            traceback.print_exc()

