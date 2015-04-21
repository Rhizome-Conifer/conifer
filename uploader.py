import boto
import os
import fcntl
import json

from urlparse import urlsplit
from pywb.utils.loaders import BlockLoader


## ============================================================================
class S3Uploader(object):
    def __init__(self, root_dir, s3_url, redis, warc_iter):
        self.root_dir = root_dir
        self.s3_url = s3_url
        self.redis = redis
        self.warc_iter = warc_iter

        parts = urlsplit(s3_url)
        self.bucket_name = parts.netloc
        self.prefix = parts.path

        self.conn = boto.connect_s3()
        self.blockloader = BlockLoader()
        self.blockloader.s3conn = self.conn

        self.bucket = self.conn.get_bucket(parts.netloc)

    def do_upload(self, local, s3_path, s3_url):
        with open(local, 'r') as fh:
            try:
                fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except Exception as e:
                print(e)
                print('Skipping {0}, not yet done'.format(local))
                return False

            try:
                new_key = self.bucket.new_key(s3_path)
                print('Uploading {0} -> {1}'.format(local, s3_url))
                new_key.set_contents_from_file(fh, replace=True)
            except Exception as e:
                print(e)
                print('Failed to Upload to {0}'.format(s3_path))
                return False

        return True

    def is_s3_avail(self, s3_url):
        parts = urlsplit(s3_url)
        # some other bucket
        if parts.netloc != self.bucket_name:
            return False

        key = self.bucket.get_key(parts.path)
        return key is not None


    def is_s3_avail_range(self, s3_url):
        try:
            stream = self.blockloader.load_s3(s3_url, 10, 20)
            buff = stream.read(50)
            if len(buff) == 20:
                return True
        except Exception as e:
            print(e)

        return False

    def __call__(self, signum=None):
        print('Checking for new warcs...')
        for key, warc, full_path, rel_path in self.warc_iter(self.root_dir):
            s3_path = self.prefix + rel_path
            s3_url = 's3://' + self.bucket_name + s3_path
            key = 'warc:' + key

            # already uploaded on last past, verify that its accessible
            # and if so, delete original
            if self.redis.hget(key, warc) == s3_url:
                if self.is_s3_avail(s3_url):
                    print('S3 Verified, Deleting: {0}'.format(full_path))
                    os.remove(full_path)
                else:
                    print('Not yet available: {0}'.format(full_path))
                continue

            if not self.do_upload(full_path, s3_path, s3_url):
                continue

            # update path index to point to s3!
            self.redis.hset(key, warc, s3_url)

            # store last modified time and size
            stats = os.stat(full_path)
            res = {'size': stats.st_size,
                   'mtime': stats.st_mtime,
                   'name': warc}

            self.redis.sadd('done:' + key, json.dumps(res))

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
                full_path = os.path.join(archive_dir, warc)
                rel_path = os.path.relpath(full_path, root_dir)
                yield key, warc, full_path, rel_path


def main():
    from redis import StrictRedis
    redis = StrictRedis.from_url('redis://127.0.0.1:6379/1')

    uploader = S3Uploader('./', 's3://target-bucket-path/', redis, iter_all_accounts)
    uploader()

if __name__ == "__main__":
    main()
