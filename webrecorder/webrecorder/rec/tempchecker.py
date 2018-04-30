import redis
import os
import json
import glob
import requests
import shutil

from webrecorder.models import User
from webrecorder.models.base import BaseAccess


# ============================================================================
class TempChecker(object):
    def __init__(self, config):
        super(TempChecker, self).__init__()

        self.redis_base_url = os.environ['REDIS_BASE_URL']

        self.data_redis = redis.StrictRedis.from_url(self.redis_base_url,
                                                     decode_responses=True)

        # beaker always uses db 0, so using db 0
        #self.redis_base_url = self.redis_base_url.rsplit('/', 1)[0] + '/0'
        self.sesh_redis = redis.StrictRedis.from_url(os.environ['REDIS_SESSION_URL'],
                                                     decode_responses=True)

        self.temp_prefix = config['temp_prefix']
        self.record_root_dir = os.environ['RECORD_ROOT']
        self.glob_pattern = os.path.join(self.record_root_dir, self.temp_prefix + '*')
        #self.temp_dir = os.path.join(self.record_root_dir, 'temp')

        self.sesh_key_template = config['session.key_template']

        print('Temp Checker Root: ' + self.glob_pattern)

    def _delete_if_expired(self, temp_user, temp_dir):
        temp_key = 't:' + temp_user
        sesh = self.sesh_redis.get(temp_key)
        if sesh:
            if self.sesh_redis.get(self.sesh_key_template.format(sesh)):
                #print('Skipping active temp ' + temp)
                return False

            self.sesh_redis.delete(temp_key)

        #record_host = os.environ['RECORD_HOST']
        print('Deleting ' + temp_dir)

        user = User(my_id=temp_user,
                    redis=self.data_redis,
                    access=BaseAccess())

        user.delete_me()

        try:
            shutil.rmtree(temp_dir)
        except Exception as e:
            print(e)

        return True

    def __call__(self):
        print('Temp Dir Check')

        temps_to_remove = set()

        # check warc dirs
        for temp_dir in glob.glob(self.glob_pattern):
            if temp_dir.startswith('.'):
                continue

            if not os.path.isdir(temp_dir):
                continue

            #try:
            #    os.rmdir(temp_dir)
            #    print('Removed Dir ' + temp_dir)
            #    continue
            #except Exception as e:
            #    print(e)

            # not yet removed, need to delete contents
            temp_user = temp_dir.rsplit(os.path.sep, 1)[1]

            temps_to_remove.add((temp_user, temp_dir))

        temp_match = 'u:{0}*'.format(self.temp_prefix)

        #print('Temp Key Check')

        for redis_key in self.data_redis.scan_iter(match=temp_match):
            temp_user = redis_key.rsplit(':', 2)[1]

            if temp_user not in temps_to_remove:
                temps_to_remove.add((temp_user, os.path.join(self.record_root_dir, temp_user)))

        # remove if expired
        for temp_user, temp_dir in temps_to_remove:
            self._delete_if_expired(temp_user, temp_dir)


# =============================================================================
if __name__ == "__main__":
    from webrecorder.rec.worker import Worker
    Worker(TempChecker).run()

