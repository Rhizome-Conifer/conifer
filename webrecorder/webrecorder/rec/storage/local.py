import os
import shutil

from webrecorder.rec.storage.base import BaseStorage


# ============================================================================
class LocalFileStorage(BaseStorage):
    def __init__(self, config):
        super(LocalFileStorage, self).__init__(config)

        self.target_url_templ = os.environ['STORAGE_ROOT'] + self.target_url_templ

        self.full_path_prefix = config['full_warc_prefix']

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
        return self.full_path_prefix + target_url.replace(os.path.sep, '/')

    def client_url_to_target_url(self, client_url):
        if self.full_path_prefix and client_url.startswith(self.full_path_prefix):
            return client_url[len(self.full_path_prefix):]

        return client_url

    def do_delete(self, target_url, client_url):
        try:
            print('Deleting: ' + target_url)
            os.remove(target_url)
            if target_url.startswith(os.environ['STORAGE_ROOT']):
                os.removedirs(os.path.dirname(target_url))
            return True
        except Exception as e:
            print(e)
            return False



