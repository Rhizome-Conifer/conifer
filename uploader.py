import boto
import os
import fcntl
import json

from urlparse import urlsplit
from pywb.utils.loaders import BlockLoader


## ============================================================================
class S3Manager(object):
    def __init__(self, s3_url):
        self.s3_url = s3_url

        parts = urlsplit(s3_url)
        self.bucket_name = parts.netloc
        self.prefix = parts.path

        self.conn = boto.connect_s3()
        self.bucket = self.conn.get_bucket(parts.netloc)

    def download_stream(self, s3_url):
        parts = urlsplit(s3_url)

        # only accept paths to current bucket
        if parts.netloc != self.bucket_name:
            print('Invalid Bucket')
            return None

        key = self.bucket.get_key(parts.path)
        size = key.size

        key.open_read()
        return size, key

    def get_remote_url(self, rel_path):
        s3_url = 's3://' + self.bucket_name + self.prefix + rel_path
        return s3_url

    def upload_file(self, local, rel_path):
        s3_path = self.prefix + rel_path
        s3_url = self.get_remote_url(rel_path)
        with open(local, 'r') as fh:
            try:
                new_key = self.bucket.new_key(s3_path)
                print('Uploading {0} -> {1}'.format(local, s3_url))
                new_key.set_contents_from_file(fh, replace=True)
            except Exception as e:
                print(e)
                print('Failed to Upload to {0}'.format(s3_path))
                return False

        return True

    def is_avail(self, rel_path):
        s3_path = self.prefix + rel_path
        key = self.bucket.get_key(s3_path)
        return key is not None


## ============================================================================
class Uploader(object):
    def __init__(self, root_dir, remotemanager, redis, warc_iter):
        self.root_dir = root_dir
        self.remotemanager = remotemanager
        self.redis = redis
        self.warc_iter = warc_iter

    def is_locked(self, local):
        with open(local, 'r') as fh:
            try:
                fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return False
            except Exception as e:
                print(e)
                print('Skipping {0}, not yet done'.format(local))
                return True

    def __call__(self, signum=None):
        print('Checking for new warcs...')
        for key, warc, local_full_path, rel_path in self.warc_iter(self.root_dir):
            key = 'warc:' + key

            if self.is_locked(local_full_path):
                continue

            if not self.redis.get('au:' + key + warc):
                if not self.remotemanager.upload_file(local_full_path, rel_path):
                    continue

                self.redis.setex('au:' + key + warc, 60, 1)

            # already uploaded, verify that its accessible
            # if so, finalize and delete original
            if self.remotemanager.is_avail(rel_path):
                remote_url = self.remotemanager.get_remote_url(rel_path)
                self.finished_upload(key, warc, local_full_path, remote_url)
            else:
                print('Not yet available: {0}'.format(local_full_path))

    def finished_upload(self, key, warc, local_full_path, remote_url):
        # store last modified time and size
        stats = os.stat(local_full_path)
        res = {'size': stats.st_size,
               'mtime': stats.st_mtime,
               'name': warc}

        self.redis.sadd('done:' + key, json.dumps(res))

        # update path index to point to remote url!
        self.redis.hset(key, warc, remote_url)

        print('S3 Verified, Deleting: {0}'.format(local_full_path))
        os.remove(local_full_path)


def iter_all_accounts(root_dir):
    users_dir = os.path.join(root_dir, 'accounts')
    if not os.path.isdir(users_dir):
        return
    for user in os.listdir(users_dir):
        colls_dir = os.path.join(users_dir, user, 'collections')
        for coll in os.listdir(colls_dir):
            archive_dir = os.path.join(colls_dir, coll, 'archive')
            for warc in os.listdir(archive_dir):
                key = user + ':' + coll
                local_full_path = os.path.join(archive_dir, warc)
                rel_path = os.path.relpath(local_full_path, root_dir)
                yield key, warc, local_full_path, rel_path


def main():
    from redis import StrictRedis
    redis = StrictRedis.from_url('redis://127.0.0.1:6379/1')

    uploader = S3Uploader('./', 's3://target-bucket-path/', redis, iter_all_accounts)
    uploader()

if __name__ == "__main__":
    main()
