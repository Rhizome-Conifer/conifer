

# ============================================================================
class RedisUniqueComponent(object):
    INT_KEYS = ('size', 'created_at', 'updated_at')

    COUNTER_KEY = None
    INFO_KEY = None
    MY_TYPE = None

    ALL_KEYS = None

    OWNER_CLS = None

    def __init__(self, **kwargs):
        self.redis = kwargs['redis']
        self.my_id = kwargs.get('my_id', '')
        self.name = kwargs.get('name', '')
        self.access = kwargs['access']
        self.owner = None

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
        return self.get_prop('size', force_type=int, default_val=0)

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

    def get_prop(self, attr, default_val=None, force_type=None):
        if not self.loaded:
            if attr not in self.data:
                self.data[attr] = self.redis.hget(self.info_key, attr) or default_val
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

    def get_owner(self):
        if self.owner:
            return self.owner

        owner_id = self.get_prop('owner')
        if not owner_id:
            return None

        self.owner = self.OWNER_CLS(my_id=owner_id,
                                    redis=self.redis,
                                    access=self.access)

        return self.owner

    def __eq__(self, obj):
        return obj and (self.my_id == obj.my_id) and type(self) == type(obj)


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

    def move(self, obj, new_container):
        return self.rename(obj, obj.name, new_container)

    def get_objects(self, cls):
        all_objs = self.redis.hgetall(self.get_comp_map())
        obj_list = [cls(my_id=val,
                        name=name,
                        redis=self.redis,
                        access=self.access) for name, val in all_objs.items()]

        return obj_list

    def is_owner(self, owner):
        return self == owner


# ============================================================================
class BaseAccess(object):
    def can_read_coll(self, collection):
        return True

    def can_write_coll(self, collection):
        return True

    def can_admin_coll(self, collection):
        return True

    def assert_can_read_coll(self, collection):
        return True

    def assert_can_write_coll(self, collection):
        return True

    def assert_can_admin_coll(self, collection):
        return True

    def assert_is_curr_user(self, user):
        return True
