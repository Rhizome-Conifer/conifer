import boto3
import os

from six.moves.urllib.parse import urlsplit, quote_plus

from webrecorder.rec.storage.base import BaseStorage


# ============================================================================
class S3Storage(BaseStorage):
    def __init__(self):
        super(S3Storage, self).__init__()
        self.storage_root = os.environ['S3_ROOT']

        res = self._split_bucket_path(self.storage_root)
        self.bucket_name, self.storage_root = res

        self.s3 = boto3.client('s3')

    def _split_bucket_path(self, url):
        parts = urlsplit(url)
        return parts.netloc, parts.path.lstrip('/')

    def _get_s3_url(self, target_url):
        return 's3://' + self.bucket_name + '/' + target_url

    def is_valid_url(self, target_url):
        try:
            res = self.s3.head_object(Bucket=self.bucket_name,
                                      Key=target_url)

            return True


        except Exception as e:
            print(e)
            return False

    def get_client_url(self, target_url):
        return self._get_s3_url(target_url)

    def do_upload(self, target_url, full_filename):
        s3_url = self._get_s3_url(target_url)

        try:
            print('Uploading {0} -> {1}'.format(full_filename, s3_url))
            with open(full_filename, 'rb') as fh:
                self.s3.put_object(Bucket=self.bucket_name,
                                   Key=target_url,
                                   Body=fh)

            return True
        except Exception as e:
            print(e)
            print('Failed to Upload to {0}'.format(s3_url))
            return False

    def client_url_to_target_url(self, client_url):
        bucket, path = self._split_bucket_path(client_url)

        return path

    def do_delete(self, target_url, client_url):
        print('Deleting Remote', client_url)

        try:
            resp = self.s3.delete_object(Bucket=self.bucket_name,
                                         Key=target_url)
            return True
        except Exception as e:
            print(e)
            return False
