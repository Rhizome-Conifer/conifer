from webrecorder.utils import today_str


# ============================================================================
class BaseStorage(object):
    """ Base class for Webrecorder storage implementations
    """
    def __init__(self, config):
        self.cache = {}

        self.target_url_templ = config['storage_path_templ']

    def upload_file(self, user, collection, recording,
                    filename, full_filename, obj_type):
        target_url = self.target_url_templ.format(user=user,
                                                  coll=collection.my_id,
                                                  obj_type=obj_type,
                                                  filename=filename,
                                                  today=today_str())

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

