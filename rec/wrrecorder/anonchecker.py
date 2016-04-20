import redis
import os
import json


# ============================================================================
class AnonChecker(object):
    def __init__(self, config):
        self.redis_base_url = os.environ['REDIS_BASE_URL']

        self.data_redis = redis.StrictRedis.from_url(self.redis_base_url)

        # beaker always uses db 0, so using db 0
        self.redis_base_url = self.redis_base_url.rsplit('/', 1)[0] + '/0'
        self.sesh_redis = redis.StrictRedis.from_url(self.redis_base_url)

        self.record_root_dir = os.environ['RECORD_ROOT']
        self.anon_dir = os.path.join(self.record_root_dir, 'anon')

        print('Anon Checker Root: ' + self.anon_dir)

    def _delete_if_expired(self, anon):
        if self.sesh_redis.get('beaker:{0}:session'.format(anon)):
            print('Skipping active anon ' + anon)
            return False

        print('Deleting ' + anon)
        message = {'type': 'user',
                   'user': 'anon/' + anon,
                   'coll': 'anonymous',
                   'rec': '*'}

        self.sesh_redis.publish('delete', json.dumps(message))
        return True

    def __call__(self):
        print('Anon Check')
        if not os.path.isdir(self.anon_dir):
            return

        # check warc dirs
        for anon in os.listdir(self.anon_dir):
            if anon.startswith('.'):
                continue

            self._delete_if_expired(anon)

        for redis_key in self.data_redis.scan_iter(match='u:anon/*'):
            redis_key = redis_key.decode('utf-8')
            anon = redis_key[len('u:anon/'):]

            self._delete_if_expired(anon)
