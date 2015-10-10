import os

from storage import BaseStorageManager


## ============================================================================
class LocalStorageManager(BaseStorageManager):
    """ Local Storage -- mostly no-op as no files are moved
    """
    def __init__(self, local_path):
        pass

    def delete_dir(self, rel_path):
        # local deletion happens elsewhere
        pass


    def download_stream(self, remote_url):
        length = os.stat(full_path).st_size
        stream = open(full_path, 'r')
        return length, stream

    def get_remote_url(self, rel_path):
        return rel_path

    def upload_file(self, abs_local_path, rel_path):
        pass

    def is_avail(self, rel_path):
        return True
