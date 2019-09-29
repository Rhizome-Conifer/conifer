# ============================================================================
class BaseStorage(object):
    """Webrecorder storage base class.

    :ivar dict cache: cache
    :ivar str storage_root: root directory
    """

    def __init__(self, storage_root=None):
        """Initialize Webrecorder storage."""
        self.cache = {}
        self.storage_root = storage_root

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

    def get_checksum_and_size(self, filepath_or_url):
        """Returns the checksum of the supplied URL or filepath and the size of the resource

        :param str filepath_or_url: The URL or filepath to the resource that the checksum and size is desired for
        :return: A three tuple containing the kind of checksum, the checksum itself, and size
        :rtype: tuple[str|None, str|None, int|None]
        """
        return None, None, None

    def get_remote_presigned_url(self, url, expires=3600):
        """Returns a remote presigned URL for direct, validating access to resource
        from remote source. Optional, only valid for remote storage (eg. S3)

        :param str url: The URL to the resource from remote source
        :param int expires: The number of seconds the presigned url is valid for
        :return: A presigned url for downloading the supplied URL from remote source
        :rtype: str|None
        """
        return None

    def do_delete(self, target_url, client_url):
        """Delete file from storage.

        :param str target_url: target URL
        :param str client_url: client URL
        :returns: whether successful or not
        :rtype: bool
        """
        return True

