import redis
import os
import json
import glob
import requests


# ============================================================================
class TempChecker(object):
    TEMP_PREFIX = 'temp!'

    def __init__(self, config):
        self.redis_base_url = os.environ['REDIS_BASE_URL']

        self.data_redis = redis.StrictRedis.from_url(self.redis_base_url)

        # beaker always uses db 0, so using db 0
        self.redis_base_url = self.redis_base_url.rsplit('/', 1)[0] + '/0'
        self.sesh_redis = redis.StrictRedis.from_url(self.redis_base_url)

        self.record_root_dir = os.environ['RECORD_ROOT']
        self.glob_pattern = os.path.join(self.record_root_dir, self.TEMP_PREFIX + '*')
        #self.temp_dir = os.path.join(self.record_root_dir, 'temp')

        self.record_host = os.environ['RECORD_HOST']

        self.delete_url = config['url_templates']['delete']

        print('Temp Checker Root: ' + self.glob_pattern)

    def _delete_if_expired(self, temp):
        sesh = self.sesh_redis.get('t:' + temp)
        if sesh:
            sesh = sesh.decode('utf-8')
            if self.sesh_redis.get('beaker:{0}:session'.format(sesh)):
                print('Skipping active temp ' + temp)
                return False

            self.sesh_redis.delete('t:' + temp)

        print('Deleting ' + temp)

        delete_url = self.delete_url.format(record_host=self.record_host,
                                            user=temp,
                                            coll='temp',
                                            rec='*',
                                            type='user')

        #message = {'type': 'user',
        #           'user': temp,
        #           'coll': 'temp',
        #           'rec': '*'}

        #self.sesh_redis.publish('delete', json.dumps(message))
        requests.delete(delete_url)
        return True

    def __call__(self):
        print('Temp Dir Check')

        temps_removed = set()

        # check warc dirs
        for temp in glob.glob(self.glob_pattern):
            if temp.startswith('.'):
                continue

            if not os.path.isdir(temp):
                continue

            temp = temp.rsplit('/', 1)[1]

            self._delete_if_expired(temp)
            temps_removed.add(temp)

        temp_match = 'u:{0}*'.format(self.TEMP_PREFIX)

        print('Temp Key Check')

        for redis_key in self.data_redis.scan_iter(match=temp_match):
            redis_key = redis_key.decode('utf-8')
            temp = redis_key[len('u:'):]

            if temp not in temps_removed:
                self._delete_if_expired(temp)


