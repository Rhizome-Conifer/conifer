# ============================================================================
class BaseStorage(object):
    """ Base class for Webrecorder storage implementations
    """

    def __init__(self):
        self.cache = {}

    def get_collection_url(self, collection):
        return self.storage_root + collection.get_dir_path()

    def get_target_url(self, collection, obj_type, filename):
        return self.get_collection_url(collection) + '/' + obj_type + '/' + filename

    def init_collection(self, collection):
        return True

    def delete_collection(self, collection):
        return True

    def upload_file(self, user, collection, recording,
                    filename, full_filename, obj_type):

        target_url = self.get_target_url(collection, obj_type, filename)

        if self.do_upload(target_url, full_filename):
            self.cache[filename] = target_url
            return True

        return False

    def get_upload_url(self, filename):
        target_url = self.cache.get(filename)

        if not target_url or not self.is_valid_url(target_url):
            return None

        del self.cache[filename]
        return self.get_client_url(target_url)

    def delete_file(self, filename):
        target_url = self.client_url_to_target_url(filename)

        if not target_url or not self.is_valid_url(target_url):
            return None

        return self.do_delete(target_url, filename)

