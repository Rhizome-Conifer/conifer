import os
import redis

from webrecorder.models.recording import Recording
from webrecorder.models.base import BaseAccess

import logging
logger = logging.getLogger('wr.io')


# ============================================================================
class StorageCommitter(object):
    def __init__(self, config):
        super(StorageCommitter, self).__init__()

        self.redis = redis.StrictRedis.from_url(os.environ['REDIS_BASE_URL'], decode_responses=True)

        self.all_cdxj_templ = Recording.CDXJ_KEY.format(rec='*')

        logger.info('Storage Committer Started')
        logger.info('Storage Root: ' + os.environ['STORAGE_ROOT'])

    def __call__(self):
        for cdxj_key in self.redis.scan_iter(self.all_cdxj_templ):
            self.process_cdxj_key(cdxj_key)

        self.redis.publish('close_idle', '')

    def process_cdxj_key(self, cdxj_key):
        _, rec, _2 = cdxj_key.split(':', 2)

        recording = Recording(my_id=rec,
                              redis=self.redis,
                              access=BaseAccess())

        collection = recording.get_owner()
        if not collection:
            logger.debug('Deleting Invalid Rec: ' + recording.my_id)
            recording.delete_object()
            return

        if collection.is_external():
            logger.debug('Skipping recording commit for external collection: ' + collection.my_id)
            return

        if not recording.is_open(extend=False):
            recording.commit_to_storage()


# =============================================================================
def run():
    from webrecorder.rec.worker import Worker
    Worker(StorageCommitter).run()


# =============================================================================
if __name__ == "__main__":
    run()


