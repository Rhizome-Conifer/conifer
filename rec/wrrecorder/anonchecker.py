import redis
import os
import json


# ============================================================================
class AnonChecker(object):
    def __init__(self, config):
        self.redis_base_url = os.environ['REDIS_BASE_URL']

        # beaker always uses db 0, so using db 0
        self.redis_base_url = self.redis_base_url.rsplit('/', 1)[0] + '/0'
        print(self.redis_base_url)

        self.redis = redis.StrictRedis.from_url(self.redis_base_url)

        self.record_root_dir = os.environ['RECORD_ROOT']
        self.anon_dir = os.path.join(self.record_root_dir, 'anon')

        print('Anon Checker Root: ' + self.anon_dir)

    def __call__(self):
        print('Anon Check')
        if not os.path.isdir(self.anon_dir):
            return

        for anon in os.listdir(self.anon_dir):
            if anon.startswith('.'):
                continue

            if self.redis.get('beaker:{0}:session'.format(anon)):
                print('Skipping active anon ' + anon)
                continue

            print('Deleting ' + anon)
            message = {'type': 'user',
                       'user': 'anon/' + anon,
                       'coll': 'anonymous',
                       'rec': '*'}

            self.redis.publish('delete', json.dumps(message))


