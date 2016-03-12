import boto
from six.moves.urllib.parse import urlsplit

from storage import BaseStorageManager


## ============================================================================
class S3Manager(BaseStorageManager):
    def __init__(self, s3_url):
        self.s3_url = s3_url

        parts = urlsplit(s3_url)
        self.bucket_name = parts.netloc
        self.prefix = parts.path.lstrip('/')

        self.conn = None
        self.bucket = None

    def _get_bucket(self):
        if not self.bucket:
            self.conn = boto.connect_s3()
            self.bucket = self.conn.get_bucket(self.bucket_name)
        return self.bucket

    def delete_dir(self, rel_path):
        s3_path = self.prefix + rel_path
        bucket = self._get_bucket()
        delete_list = []
        for key in bucket.list(prefix=s3_path):
            delete_list.append(key)
            print('Deleting ' + key.name)

        bucket.delete_keys(delete_list)

    def download_stream(self, remote_url):
        parts = urlsplit(remote_url)

        # only accept paths to current bucket
        if parts.netloc != self.bucket_name:
            print('Invalid Bucket')
            return None

        key = self._get_bucket().get_key(parts.path)
        size = key.size

        key.open_read()
        return size, key

    def get_remote_url(self, rel_path):
        s3_url = 's3://' + self.bucket_name + '/' + self.prefix + rel_path
        return s3_url

    def upload_file(self, local, rel_path):
        s3_path = self.prefix + rel_path
        s3_url = self.get_remote_url(rel_path)

        with open(local, 'rb') as fh:
            try:
                new_key = self._get_bucket().new_key(s3_path)
                print('Uploading {0} -> {1}'.format(local, s3_url))
                new_key.set_contents_from_file(fh, replace=True)
            except Exception as e:
                print(e)
                print('Failed to Upload to {0}'.format(s3_url))
                return False

        return True

    def is_avail(self, rel_path):
        s3_path = self.prefix + rel_path
        key = self._get_bucket().get_key(s3_path)
        return key is not None

