import os
import redis

from webrecorder.models.recording import Recording
from webrecorder.models.base import BaseAccess


# ============================================================================
class StorageCommitter(object):
    def __init__(self, config):
        super(StorageCommitter, self).__init__()

        self.redis = redis.StrictRedis.from_url(os.environ['REDIS_BASE_URL'], decode_responses=True)

        self.all_cdxj_templ = Recording.CDXJ_KEY.format(rec='*')

        print('Storage Committer Started')
        print('Storage Root: ' + os.environ['STORAGE_ROOT'])

    def __call__(self):
        for cdxj_key in self.redis.scan_iter(self.all_cdxj_templ):
            self.process_cdxj_key(cdxj_key)

        self.redis.publish('close_idle', '')

    def process_cdxj_key(self, cdxj_key):
        _, rec, _2 = cdxj_key.split(':', 2)

        recording = Recording(my_id=rec,
                              redis=self.redis,
                              access=BaseAccess())

        if not recording.is_open(extend=False):
            recording.commit_to_storage()


# =============================================================================
if __name__ == "__main__":
    from webrecorder.rec.worker import Worker
    Worker(StorageCommitter).run()


