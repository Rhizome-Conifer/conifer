import redis
import os
import json
import glob
import requests


# ============================================================================
class TempChecker(object):
    def __init__(self, config):
        self.redis_base_url = os.environ['REDIS_BASE_URL']

        self.data_redis = redis.StrictRedis.from_url(self.redis_base_url)

        # beaker always uses db 0, so using db 0
        #self.redis_base_url = self.redis_base_url.rsplit('/', 1)[0] + '/0'
        self.sesh_redis = redis.StrictRedis.from_url(os.environ['REDIS_SESSION_URL'])

        self.temp_prefix = config['temp_prefix']
        self.record_root_dir = os.environ['RECORD_ROOT']
        self.glob_pattern = os.path.join(self.record_root_dir, self.temp_prefix + '*')
        #self.temp_dir = os.path.join(self.record_root_dir, 'temp')

        self.record_host = os.environ['RECORD_HOST']

        self.delete_url = config['url_templates']['delete']

        self.sesh_key_template = config['session.key_template']

        print('Temp Checker Root: ' + self.glob_pattern)

    def _delete_if_expired(self, temp):
        sesh = self.sesh_redis.get('t:' + temp)
        if sesh:
            sesh = sesh.decode('utf-8')
            if self.sesh_redis.get(self.sesh_key_template.format(sesh)):
                #print('Skipping active temp ' + temp)
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

            try:
                os.rmdir(temp)
                print('Removed Dir ' + temp)
            except Exception as e:
                print(e)

            temp = temp.rsplit('/', 1)[1]

            self._delete_if_expired(temp)
            temps_removed.add(temp)

        temp_match = 'u:{0}*'.format(self.temp_prefix)

        #print('Temp Key Check')

        for redis_key in self.data_redis.scan_iter(match=temp_match):
            redis_key = redis_key.decode('utf-8')
            temp_user = redis_key.rsplit(':', 2)[1]

            if temp_user not in temps_removed:
                self._delete_if_expired(temp_user)


