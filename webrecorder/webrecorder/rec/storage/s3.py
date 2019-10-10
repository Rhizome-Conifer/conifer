import logging
import os

import boto3
from six.moves.urllib.parse import urlsplit

from webrecorder.rec.storage.base import BaseStorage

logger = logging.getLogger('wr.io')


# ============================================================================
class S3Storage(BaseStorage):
    """Webrecorder storage (Amazon S3).

    :ivar str bucket_name: name of S3 bucket
    :ivar s3: service client
    """

    def __init__(self):
        """Initialize Webrecorder storage."""
        super(S3Storage, self).__init__(os.environ['S3_ROOT'])

        res = self._split_bucket_path(self.storage_root)
        self.bucket_name, self.storage_root = res

        self.s3 = boto3.client('s3')
        self.is_local_storage = False

    def _split_bucket_path(self, url):
        """Split S3 bucket URL into network location and path.

        :param str url: S3 bucket URL

        :returns: network location and path
        :rtype: str and str
        """
        parts = urlsplit(url)
        return parts.netloc, parts.path.lstrip('/')

    def _get_s3_url(self, target_url):
        """Return S3 bucket URL.

        :param str target_url: target URL

        :returns: S3 bucket URL
        :rtype: str
        """
        return 's3://' + self.bucket_name + '/' + target_url

    def is_valid_url(self, target_url):
        """Return whether given URL is a valid URL.

        :param str target_url: target URL

        :returns: whether given URL is valid
        :rtype: bool
        """
        try:
            res = self.s3.head_object(Bucket=self.bucket_name,
                                      Key=target_url)

            return True


        except Exception as e:
            return False

    def get_client_url(self, target_url):
        """Return client URL.

        :param str target_url: target URL

        :returns: client URL
        :rtype: str
        """
        return self._get_s3_url(target_url)

    def do_upload(self, target_url, full_filename):
        """Upload file into Webrecorder storage.

        :param str target_url: target URL
        :param str full_filename: filename

        :returns: whether successful or not
        :rtype: bool
        """
        s3_url = self._get_s3_url(target_url)

        try:
            logger.debug('S3: Uploading {0} -> {1}'.format(full_filename, s3_url))
            self.s3.upload_file(full_filename,
                                Bucket=self.bucket_name,
                                Key=target_url)

            return True
        except Exception as e:
            logger.debug(str(e))
            logger.debug('S3: Failed to Upload to {0}'.format(s3_url))
            return False

    def client_url_to_target_url(self, client_url):
        """Get target URL (from client URL).

        :param str client_url: client URL

        :returns: target_url
        :rtype: str
        """
        bucket, path = self._split_bucket_path(client_url)

        return path

    def do_delete(self, target_url, client_url):
        """Delete file from storage.

        :param str target_url: target URL
        :param str client_url: client URL

        :returns: whether successful or not
        :rtype: bool
        """
        logger.debug('S3: Deleting Remote', client_url)

        try:
            resp = self.s3.delete_object(Bucket=self.bucket_name,
                                         Key=target_url)
            return True
        except Exception as e:
            logger.debug(str(e))
            return False

    def get_remote_presigned_url(self, url, expires=3600):
        """Returns a presigned URL for access to the supplied resource URL on s3

        :param str url: The URL to the resource on s3
        :param int expires: The number of seconds the presigned url is valid for
        :return: A presigned url for downloading the supplied URL straight from s3
        :rtype: str|None
        """
        path = self.client_url_to_target_url(url)
        params = {'Bucket': self.bucket_name, 'Key': path}
        try:
            return self.s3.generate_presigned_url('get_object', Params=params, ExpiresIn=expires)
        except Exception:
            return None

    def get_checksum_and_size(self, filepath_or_url):
        """Returns the checksum of the supplied URL or filepath and the size of the resource

        :param str filepath_or_url: The URL or filepath to the resource that the checksum and size is desired for
        :return: A three tuple containing the kind of checksum, the checksum itself, and size
        :rtype: tuple[str|None, str|None, int|None]
        """
        path = self.client_url_to_target_url(filepath_or_url)
        try:

            res = self.s3.head_object(Bucket=self.bucket_name,
                                      Key=path)
            # strip off quotes and return md5
            etag = res['ETag'][1:-1]
            kind = 's3etag' if '-' in etag else 'md5'
            return kind, etag, res['ContentLength']
        except Exception:
            return None, None, None
