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


