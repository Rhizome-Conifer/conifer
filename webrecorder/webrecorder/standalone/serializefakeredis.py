import os
import logging
import json
import datetime

from gzip import open

from fakeredis import DATABASES, _ZSet, _Hash, _ExpiringDict


# ============================================================================
class FakeRedisSerializer(object):
    VERSION = '2.1'

    def __init__(self, filename, inputs):
        self.filename = filename
        self.inputs = inputs
        self.update_needed = True

    def _get_file_check(self):
        check = {}

        for input_file in self.inputs:
            input_file = os.path.abspath(input_file)
            res = os.stat(input_file)
            check[input_file] = {'file_size': res.st_size, 'file_mod': res.st_mtime}

        return check


    def save_db(self):
        if not self.update_needed:
            logging.debug('Redis DB Loaded from Cache, No Save Needed')
            return

        all_dbs = {}
        for db in DATABASES:
            all_dbs[db] = self.save_redis_dict(DATABASES[db])

        check = self._get_file_check()

        root = {'all_dbs':  all_dbs,
                'version': self.VERSION,
                'file_check': check}

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

            check = self._get_file_check()

            assert(root['file_check'] == check)

            DATABASES.clear()
            for db, obj in root['all_dbs'].items():
                db = int(db)
                DATABASES[db] = self.load_redis_dict(obj)

        except FileNotFoundError as fe:
            return False

        except Exception as e:
            import traceback
            traceback.print_exc()

            logging.debug('Redis DB Load from {0} Failed: {1}'.format(self.filename, e))
            return False

        self.update_needed = False
        return True

    def save_redis_dict(self, value):
        new_dict = {}
        exp = None

        if hasattr(value, 'redis_type'):
            redis_type = value.redis_type.decode('utf-8')
        else:
            redis_type = 'exp'

        new_dict['__redis_type'] = redis_type

        for key, value in value._dict.items():
            key = key.decode('utf-8')

            if redis_type == 'exp':
                if isinstance(value, tuple):
                    exp = value[1].timestamp() if value[1] else None
                    value = value[0]
                else:
                    exp = None

            if isinstance(value, bytes):
                value = value.decode('utf-8')
            elif isinstance(value, set):
                value = self.save_redis_set(value)
            elif hasattr(value, '_dict'):
                value = self.save_redis_dict(value)

            if redis_type == 'exp':
                value = [value, exp]

            new_dict[key] = value
        return new_dict

    def load_redis_dict(self, obj):
        new_dict = {}
        redis_type = obj.get('__redis_type')
        exp = None
        for key, value in obj.items():
            if key == '__redis_type':
                continue

            key = key.encode('utf-8')

            if redis_type == 'exp' and isinstance(value, list):
                if isinstance(value[1], int):
                    exp = datetime.utcfromtimestamp(value[1])
                else:
                    exp = None
                value = value[0]

            if isinstance(value, str):
                value = value.encode('utf-8')
            elif isinstance(value, list):
                value = self.load_redis_set(value)
            elif isinstance(value, dict):
                value = self.load_redis_dict(value)

            if redis_type == 'exp':
                new_dict[key] = (value, exp)
            else:
                new_dict[key] = value

        if redis_type == 'zset':
            redis_dict = _ZSet()
        elif redis_type == 'hash':
            redis_dict = _Hash()
        elif redis_type == 'exp':
            redis_dict = _ExpiringDict()
        else:
            raise Exception('Invalid redis_dict: ' + str(redis_type))

        redis_dict._dict = new_dict
        return redis_dict

    def save_redis_set(self, value):
        return [val.decode('utf-8') for val in value]
        #return {'__redis_type': 'set', 'set': [val.decode('utf-8') for val in value]}

    def load_redis_set(self, value):
        return {val.encode('utf-8') for val in value}
        #return set(value['set'])

