import boto
import os
import fcntl
import json
import session

from redis import StrictRedis


## ============================================================================
class Uploader(object):
    def __init__(self, root_dir, remotemanager, signer, redis, warc_iter):
        self.root_dir = root_dir
        self.remotemanager = remotemanager
        self.signer = signer
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
        print('Checking for new warcs in {0}'.format(self.root_dir))
        for key, warc, local_full_path, rel_path in self.warc_iter(self.root_dir):
            key = key + ':warc'
            warc_already_uploaded_key = key + ':au:' + warc

            if self.is_locked(local_full_path):
                continue

            if not self.redis.get(warc_already_uploaded_key):
                # Sign before uploading
                if self.signer and not self.signer.verify(local_full_path):
                    self.signer.sign(local_full_path)

                if not self.remotemanager.upload_file(local_full_path, rel_path):
                    continue

                self.redis.setex(warc_already_uploaded_key, 60, 1)

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

        self.redis.sadd(key + ':done', json.dumps(res))

        # update path index to point to remote url!
        self.redis.hset(key, warc, remote_url)

        print('S3 Verified, Deleting: {0}'.format(local_full_path))
        os.remove(local_full_path)


## ============================================================================
def iter_all_accounts(root_dir):
    users_dir = os.path.join(root_dir, 'accounts')
    if not os.path.isdir(users_dir):
        return
    for user in os.listdir(users_dir):
        if user.startswith('.'):
            continue
        colls_dir = os.path.join(users_dir, user, 'collections')
        if not os.path.isdir(colls_dir):
            continue
        for coll in os.listdir(colls_dir):
            archive_dir = os.path.join(colls_dir, coll, 'archive')
            if not os.path.isdir(archive_dir):
                continue
            for warc in os.listdir(archive_dir):
                key = user + ':' + coll
                local_full_path = os.path.join(archive_dir, warc)
                rel_path = os.path.relpath(local_full_path, root_dir)
                yield key, warc, local_full_path, rel_path


## ============================================================================
class AnonChecker(object):
    def __init__(self, root_dir, manager, seshinfo):
        self.anon_dir = os.path.join(root_dir, 'anon')
        self.manager = manager

        url = seshinfo['session.url']
        self.redis = StrictRedis.from_url('redis://' + url)

    def __call__(self):
        if not os.path.isdir(self.anon_dir):
            return

        for anon in os.listdir(self.anon_dir):
            if anon.startswith('.'):
                continue

            if self.redis.get('beaker:{0}:session'.format(anon)):
                print('Skipping active anon ' + anon)
                continue

            print('Deleting ' + anon)
            try:
                user = session.make_anon_user(anon)
                self.manager.delete_anon_user(user)
            except Exception as e:
                print(e)


## ============================================================================
def main():
    redis = StrictRedis.from_url('redis://127.0.0.1:6379/1')

    uploader = S3Uploader('./', 's3://target-bucket-path/', redis, iter_all_accounts)
    uploader()

if __name__ == "__main__":
    main()
