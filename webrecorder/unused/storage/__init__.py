from __future__ import absolute_import


## ============================================================================
class BaseStorageManager(object):
    """ Base class for backend storage support
    "rel_path" -- represents local relative path to WARC
    "remote_url" -- represents absolute url to remote WARC
    """

    def delete_dir(self, rel_path):
        """ Delete remote user or collection directory"""
        raise NotImplemented()

    def download_stream(self, remote_url):
        """ Stream WARC data from remote source
        returns (length, stream) tuple
        """
        raise NotImplemented()

    def get_remote_url(self, rel_path):
        """ Get remote url from rel_path"""
        raise NotImplemented()

    def upload_file(self, abs_local_path, rel_path):
        """ Upload specified file with rel_path and abs_local_path
        """
        raise NotImplemented()

    def is_avail(self, rel_path):
        """ Return true if remote url for this rel_path is available
        """
        raise NotImplemented()
