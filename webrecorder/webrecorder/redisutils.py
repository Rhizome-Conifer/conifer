import json


# ============================================================================
class RedisTable(object):
    def __init__(self, redis, key):
        self.redis = redis
        self.key = key
        self.iteritems = self.items

    def __contains__(self, name):
        value = self.redis.hget(self.key, name)
        return value is not None

    def __setitem__(self, name, values):
        if isinstance(values, RedisHashTable):
            values = values.thedict

        string = json.dumps(values)
        return self.redis.hset(self.key, name, string)

    def __delitem__(self, name):
        return self.redis.hdel(self.key, name)

    def __getitem__(self, name):
        string = self.redis.hget(self.key, name)
        if not string:
            return {}
        result = json.loads(string)
        if isinstance(result, dict):
            return RedisHashTable(self, name, result)
        else:
            return result

    def __iter__(self):
        keys = self.redis.hkeys(self.key)
        return iter(keys)

    def items(self):
        coll_list = self.redis.hgetall(self.key)
        colls = {}

        def _iteritems():
            for n, v in coll_list.items():
                if n == 'total_len':
                    continue

                #colls[n] = json.loads(v)
                yield n, json.loads(v)

        return _iteritems()
        #return colls.iteritems()

    def pop(self, name):
        result = self[name]
        if result:
            self.redis.hdel(self.key, name)
        return result


# ============================================================================
class RedisHashTable(object):
    def __init__(self, redistable, key, thedict):
        self.redistable = redistable
        self.key = key
        self.thedict = thedict

    def __getitem__(self, name):
        return self.thedict[name]

    def __setitem__(self, name, value):
        self.thedict[name] = value
        self.redistable[self.key] = self.thedict

    def __delitem__(self, name):
        del self.thedict[name]
        self.redistable[self.key] = self.thedict

    def get(self, name, default_val=''):
        return self.thedict.get(name, default_val)

    def __nonzero__(self):
        return bool(self.thedict)


# ============================================================================
class RedisIdMapper(object):
    def __init__(self, redis, typename, name_key):
        self.redis = redis
        self.typename = typename
        self.counter = 'n:{typename}:count'.format(typename=typename)

        self.name_key = name_key

    def create_new(self, param, name, title):
        id_ = self.redis.incr(self.counter)

        dupe_count = 1
        orig_title = title
        orig_name = name

        name_map = self.name_key.format(param)

        while True:
            if self.redis.hsetnx(name_map, name, id_) == 1:
                break

            dupe_count += 1
            name = orig_name + '-' + str(dupe_count)
            title = orig_title + ' ' + str(dupe_count)

        return id_, name, title

    def name_to_id(self, param, name):
        name_map = self.name_key.format(param)
        print(name_map, name)

        return self.redis.hget(name_map, name)


