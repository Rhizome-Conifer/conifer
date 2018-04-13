import os
import shutil

from webrecorder.rec.storage.base import BaseStorage
from webrecorder.models.recording import Recording


# ============================================================================
class DirectLocalFileStorage(BaseStorage):
    def __init__(self):
        super(DirectLocalFileStorage, self).__init__()

        self.storage_root = os.environ['STORAGE_ROOT']

    def delete_collection_dir(self, dir_path):
        local_dir = os.path.join(self.storage_root, dir_path)

        try:
            print('Deleting Directory: ' + local_dir)
            parent_dir = os.path.dirname(local_dir)
            shutil.rmtree(local_dir)
            os.removedirs(parent_dir)
            return True
        except Exception as e:
            print(e)
            return False

    def do_upload(self, target_url, full_filename):
        os.makedirs(os.path.dirname(target_url), exist_ok=True)

        try:
            shutil.copyfile(full_filename, target_url)
            return True
        except Exception as e:
            print(e)
            return False

    def is_valid_url(self, target_url):
        return os.path.isfile(target_url)

    def get_client_url(self, target_url):
        return Recording.FULL_WARC_PREFIX + target_url.replace(os.path.sep, '/')

    def client_url_to_target_url(self, client_url):
        return Recording.strip_prefix(client_url)

    def do_delete(self, target_url, client_url):
        try:
            print('Deleting: ' + target_url)
            os.remove(target_url)
            #if target_url.startswith(self.storage_root):
            #    os.removedirs(os.path.dirname(target_url))
            return True
        except Exception as e:
            print(e)
            return False


# ============================================================================
class LocalFileStorage(DirectLocalFileStorage):
    def __init__(self, redis):
        self.redis = redis
        super(LocalFileStorage, self).__init__()

    def delete_collection(self, collection):
        dirpath = os.path.join(self.storage_root, collection.get_dir_path())
        return (self.redis.publish('handle_delete_dir', dirpath) > 0)

    def do_delete(self, target_url, client_url):
        return (self.redis.publish('handle_delete_file', target_url) > 0)



