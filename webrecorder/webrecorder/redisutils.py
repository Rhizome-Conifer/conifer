# standard library imports
import json


class RedisTable(object):
    """Redis hash interface.

    :ivar StrictRedis redis: Redis interface
    :ivar str key: key (Redis hash)
    :ivar method iteritems: items in Redis hash
    """

    def __init__(self, redis, key):
        """Initialize Redis hash interface.

        :param StrictRedis redis: Redis interface
        :param str key: key (Redis)
        """
        self.redis = redis
        self.key = key
        self.iteritems = self.items

    def __contains__(self, name):
        """Test membership.

        :param str name: key (Redis hash)

        :returns: value if key is found else None
        :rtype: n.s. or None
        """
        value = self.redis.hget(self.key, name)
        return value is not None

    def __setitem__(self, name, values):
        """Set key in Redis hash to values.

        :param str name: key (Redis hash)
        :param values: map
        :type: RedisHashTable or n.s.

        :returns: '0' in case of success or '1' in case of failure
        :rtype: str
        """
        if isinstance(values, RedisHashTable):
            values = values.thedict
        string = json.dumps(values)
        return self.redis.hset(self.key, name, string)

    def __delitem__(self, name):
        """Delete key from Redis hash.

        :param str name: key (Redis hash)

        :returns: '0' in case of success or '1' in case of failure
        :rtype: str
        """
        return self.redis.hdel(self.key, name)

    def __getitem__(self, name):
        """Get item from Redis hash.

        :param str name: key (Redis hash)

        :returns: values in case of success or empty dict in case of failure
        :rtype: RedisHashTable or dict
        """
        string = self.redis.hget(self.key, name)
        if not string:
            return {}
        result = json.loads(string)
        if isinstance(result, dict):
            return RedisHashTable(self, name, result)
        else:
            return result

    def __iter__(self):
        """Returns iterator over the keys in the hash.

        :returns: iterator
        :rtype: dict_keyiterator
        """
        keys = self.redis.hkeys(self.key)
        return iter(keys)

    def items(self):
        """Returns iterator over the maps in the hash.

        :returns: iterator
        :rtype: generator
        """
        coll_list = self.redis.hgetall(self.key)

        def _iteritems():
            """Iterate over the maps in the hash."""
            for n, v in coll_list.items():
                if n == 'total_len':
                    continue

                yield n, json.loads(v)

        return _iteritems()

    def pop(self, name):
        """Get and delete item from hash.

        :param str name: key (Redis hash)

        :returns: values in case of success or empty dict in case of failure
        :rtype: RedisHashTable or dict
        """
        result = self[name]
        if result:
            self.redis.hdel(self.key, name)
        return result


class RedisHashTable(object):
    """Redis map (in Redis hash) interface.

    :ivar RedisTable redistable: Redis hash interface
    :ivar str key: key (Redis hash)
    :ivar dict thedict: hash
    """

    def __init__(self, redistable, key, thedict):
        """Initialize Redis hash interface.

        :param RedisTable redistable: Redis interface
        :param str key: key (Redis hash)
        :param dict thedict: map
        """
        self.redistable = redistable
        self.key = key
        self.thedict = thedict

    def __getitem__(self, name):
        """Get value from Redis hash.

        :param str name: key (map in Redis hash)
        """
        return self.thedict[name]

    def __setitem__(self, name, value):
        """Set key in Redis hash to value.

        :param str name: key (map in Redis hash)
        :param value: value
        """
        self.thedict[name] = value
        self.redistable[self.key] = self.thedict

    def __delitem__(self, name):
        """Delete key from Redis hash.

        :param str name: key (map in Redis hash)
        """
        del self.thedict[name]
        self.redistable[self.key] = self.thedict

    def get(self, name, default_val=''):
        """Get value from Redis hash or default value if key is not found.

        :param str name: key (map in Redis hash)
        :param str default_val: default value
        """
        return self.thedict.get(name, default_val)

    def __nonzero__(self):
        """Test truth value.

        :returns: whether Redis hash is empty
        :rtype: bool
        """
        return bool(self.thedict)
