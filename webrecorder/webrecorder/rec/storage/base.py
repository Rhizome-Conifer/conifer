# ============================================================================
class BaseStorage(object):
    """Webrecorder storage base class.

    :ivar dict cache: cache
    :ivar str storage_root: root directory
    """

    def __init__(self):
        """Initialize Webrecorder storage."""
        self.cache = {}

    def get_collection_url(self, collection):
        """Return collection URL.

        :param collection: collection
        :type: n.s.

        :returns: collection URL
        :rtype: str
        """
        return self.storage_root + collection.get_dir_path()

    def get_target_url(self, collection, obj_type, filename):
        """Return target URL.

        :param collection: collection (of target)
        :type: n.s.
        :param str obj_type: type of target
        :param str filename: filename

        :returns: target URL
        :rtype: str
        """
        url = self.get_collection_url(collection) + '/'
        if obj_type:
            url += obj_type + '/'

        url += filename
        return url

    def init_collection(self, collection):
        """Initialize collection.

        :param collection: collection
        :type: n.s.

        :returns: whether successful or not
        :rtype: bool
        """
        return True

    def delete_collection(self, collection):
        """Delete collection.

        :param collection: collection
        :type: n.s.

        :returns: whether successful or not
        :rtype: bool
        """
        return True

    def upload_file(self, user, collection, recording,
                    filename, full_filename, obj_type):
        """Upload file into storage.

        :param User user: user (unused argument)
        :param Collection collection: collection
        :param Recording recording: recording (unused argument)
        :param str filename: filename
        :param str full_filename: path
        :param str obj_type: type of target

        :returns: whether successful or not
        :rtype: bool
        """

        target_url = self.get_target_url(collection, obj_type, filename)

        if self.do_upload(target_url, full_filename):
            self.cache[filename] = target_url
            return True

        return False

    def get_upload_url(self, filename):
        """Return upload URL.

        :param str filename: filename

        :returns: upload URL
        :rtype: str
        """
        target_url = self.cache.get(filename)

        if not target_url or not self.is_valid_url(target_url):
            return None

        del self.cache[filename]
        return self.get_client_url(target_url)

    def delete_file(self, filename):
        """Delete file from storage.

        :param str filename: filename

        :returns: whether successful or not
        :rtype: bool
        """
        if not filename:
            return False

        target_url = self.client_url_to_target_url(filename)

        if not target_url or not self.is_valid_url(target_url):
            return False

        return self.do_delete(target_url, filename)

