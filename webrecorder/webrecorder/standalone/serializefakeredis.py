import os
import logging
import json
from gzip import open
import fakeredis
from fakeredis import DATABASES, _StrKeyDict, _ZSet, _Hash


# ============================================================================
class SerializableFakeRedis(fakeredis.FakeStrictRedis):
    filename = None
    load_needed = True

    def __init__(self, *args, **kwargs):
        super(SerializableFakeRedis, self).__init__(*args, **kwargs)

        if self.filename and os.path.isfile(self.filename):
            self.load_db()

    @classmethod
    def save_db(cls):
        if not cls.load_needed:
            logging.debug('Redis DB Loaded from Cache, No Save Needed')
            return

        all_dbs = {}
        for db in DATABASES:
            all_dbs[db] = cls.save_redis_dict(DATABASES[db])

        with open(cls.filename, 'wt') as fh:
            fh.write(json.dumps(all_dbs))

    @classmethod
    def save_redis_dict(cls, value):
        new_dict = {}

        if hasattr(value, 'redis_type'):
            new_dict['__redis_type'] = value.redis_type.decode('utf-8')

        for key, value in value._dict.items():
            key = key.decode('utf-8')

            if isinstance(value, bytes):
                value = value.decode('utf-8')
            elif isinstance(value, set):
                value = [val.decode('utf-8') for val in value]
            elif hasattr(value, '_dict'):
                value = cls.save_redis_dict(value)

            new_dict[key] = value
        return new_dict

    @classmethod
    def load_redis_dict(cls, obj):
        new_dict = {}
        redis_type = None
        for key, value in obj.items():
            if key == '__redis_type':
                redis_type = value
                continue

            key = key.encode('utf-8')

            if isinstance(value, str):
                value = value.encode('utf-8')
            elif isinstance(value, list):
                value = {val.encode('utf-8') for val in value}
            elif isinstance(value, dict):
                value = cls.load_redis_dict(value)

            new_dict[key] = value

        if redis_type == 'zset':
            redis_dict = _ZSet()
        elif redis_type == 'hash':
            redis_dict = _Hash()
        else:
            redis_dict = _StrKeyDict()

        redis_dict._dict = new_dict
        return redis_dict

    @classmethod
    def load_db(cls):
        if not cls.load_needed:
            return False

        logging.debug('Loading Redis DB')
        cls.load_needed = False
        try:
            with open(cls.filename, 'rt') as fh:
                buff = fh.read()

            all_dbs = json.loads(buff)

            DATABASES.clear()
            for db, obj in all_dbs.items():
                db = int(db)
                DATABASES[db] = cls.load_redis_dict(obj)

        except Exception as e:
            logging.debug('Redis DB Load from {0} Failed: {1}'.format(cls.filename, e))

