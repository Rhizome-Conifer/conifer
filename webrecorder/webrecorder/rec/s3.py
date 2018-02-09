import boto3
from six.moves.urllib.parse import urlsplit, quote_plus


# ============================================================================
class S3Storage(object):
    def __init__(self, config):
        self.remote_url_templ = config['remote_url_templ']

        res = self._split_bucket_path(self.remote_url_templ)
        self.bucket_name, self.remote_path_templ = res

        self.config = config

        self.s3 = boto3.client('s3', aws_access_key_id=config.get('aws_access_key_id'),
                                     aws_secret_access_key=config.get('aws_secret_access_key'))

        #self.bucket = self.conn.get_bucket(self.bucket_name)

    def _split_bucket_path(self, url):
        parts = urlsplit(url)
        return parts.netloc, parts.path.lstrip('/')

    def _get_s3_url(self, remote_path, profile_name='', with_cred=False):
        s3_url = ''

        if profile_name:
            s3_url = profile_name + '+'

        s3_url += 's3://'

        #if with_cred:
        #    s3_url += quote_plus(self.config['aws_access_key_id']) + ':'
        #    s3_url += quote_plus(self.config['aws_secret_access_key']) + '@'

        s3_url += self.bucket_name + '/' + remote_path
        return s3_url

    def get_valid_remote_url(self, user, coll, rec, filename, obj_type):
        remote_path = self.remote_path_templ.format(user=user,
                                                    coll=coll,
                                                    rec=rec,
                                                    obj_type=obj_type,
                                                    filename=filename)
        try:
            res = self.s3.head_object(Bucket=self.bucket_name,
                                      Key=remote_path)
            return self._get_s3_url(remote_path, self.config.get('profile'))
        except Exception as e:
            print(e)
            return None

    def upload_file(self, user, coll, rec, filename, full_filename, obj_type):
        remote_path = self.remote_path_templ.format(user=user,
                                                    coll=coll,
                                                    rec=rec,
                                                    obj_type=obj_type,
                                                    filename=filename)

        s3_url = self._get_s3_url(remote_path)

        try:
            print('Uploading {0} -> {1}'.format(full_filename, s3_url))
            #new_key = self.bucket.new_key(remote_path)
            #    new_key.set_contents_from_file(fh, replace=False)
            with open(full_filename, 'rb') as fh:
                self.s3.put_object(Bucket=self.bucket_name,
                                   Key=remote_path,
                                   Body=fh)
        except Exception as e:
            print(e)
            print('Failed to Upload to {0}'.format(s3_url))
            return False

        return True

    def delete(self, delete_list):
        objects = []

        for remote_file in delete_list:
            if not remote_file.startswith('s3://'):
                print('Invalid S3 Filename: ' + remote_file)
                continue

            bucket, path = self._split_bucket_path(remote_file)
            print('Deleting Remote', remote_file)

            objects.append({'Key': path})

        try:
            #self.bucket.delete_keys(path_list)
            self.s3.delete_objects(Bucket=self.bucket_name,
                                   Delete={'Objects': objects})

        except Exception as e:
            print(e)
            return False

        return True

    def delete_user(self, user):
        remote_path = self.remote_path_templ.format(user=user,
                                                    filename='')

        objects = []

        for key in self.s3.list_objects(Bucket=self.bucket_name,
                                        Prefix=remote_path):

            objects.append({'Key': key})
            print('Deleting ' + key.name)

        try:
            self.s3.delete_objects(Bucket=self.bucket_name,
                                   Delete={'Objects': objects})

        except Exception as e:
            print(e)
            return False

        return True

