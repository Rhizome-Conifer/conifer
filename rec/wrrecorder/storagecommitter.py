import os
import glob
import redis
import datetime
import fcntl


# ============================================================================
class StorageCommitter(object):
    def __init__(self, config):
        self.redis_base_url = os.environ['REDIS_BASE_URL']

        self.redis = redis.StrictRedis.from_url(self.redis_base_url)

        self.record_root_dir = os.environ['RECORD_ROOT']

        self.glob_pattern = self.record_root_dir + '*/*/*/*.warc.gz'

        print('Storage Committer Root: ' + self.record_root_dir)

    def is_locked(self, filename):
        with open(filename, 'rb') as fh:
            try:
                fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return False
            except Exception as e:
                print(e)
                print('Skipping {0}, not yet done'.format(filename))
                return True

    def __call__(self):
        if not os.path.isdir(self.record_root_dir):
            return

        for full_filename in glob.glob(self.glob_pattern):
            if self.is_locked(full_filename):
                continue

            relpath = os.path.relpath(full_filename, self.record_root_dir)

            parts = relpath.split('/')

            if len(parts) != 4:
                print('Invalid file match: ' + relpath)
                continue

            user, coll, rec, warcname = parts

            print(parts)


