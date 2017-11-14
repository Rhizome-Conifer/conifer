import os
import logging
import json
from gzip import open

from fakeredis import DATABASES, _StrKeyDict, _ZSet, _Hash


# ============================================================================
class FakeRedisSerializer(object):
    VERSION = '1'

    def __init__(self, filename):
        self.filename = filename
        self.update_needed = True

    def _get_file_info(self):
        res = os.stat(self.filename)
        return res.st_size, res.st_mtime

    def save_db(self):
        if not self.update_needed:
            logging.debug('Redis DB Loaded from Cache, No Save Needed')
            return

        all_dbs = []
        for db in DATABASES:
            all_dbs[db] = self.save_redis_dict(DATABASES[db])

        file_size, file_mod = self._get_file_info()

        root = {'all_dbs':  all_dbs,
                'version': self.VERSION,
                'file_size': file_size,
                'file_mod': file_mod}

        with open(self.filename, 'wt') as fh:
            fh.write(json.dumps(root))

    def load_db(self):
        if not self.update_needed:
            return False

        logging.debug('Loading Redis DB')
        try:
            with open(self.filename, 'rt') as fh:
                buff = fh.read()

            root = json.loads(buff)

            assert(root['version'] == self.VERSION)

            file_size, file_mod = self._get_file_info()

            assert(root['file_size'] == file_size)
            assert(root['file_mod'] == file_mod)

            DATABASES.clear()
            for db, obj in root['all_dbs'].items():
                db = int(db)
                DATABASES[db] = self.load_redis_dict(obj)

        except Exception as e:
            logging.debug('Redis DB Load from {0} Failed: {1}'.format(self.filename, e))
            return False

        self.update_needed = False
        return True

    def save_redis_dict(self, value):
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
                value = self.save_redis_dict(value)

            new_dict[key] = value
        return new_dict

    def load_redis_dict(self, obj):
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
                value = self.load_redis_dict(value)

            new_dict[key] = value

        if redis_type == 'zset':
            redis_dict = _ZSet()
        elif redis_type == 'hash':
            redis_dict = _Hash()
        else:
            redis_dict = _StrKeyDict()

        redis_dict._dict = new_dict
        return redis_dict

