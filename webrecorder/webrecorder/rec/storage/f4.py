import os
import requests

from webrecorder.rec.storage.base import BaseStorage


# ============================================================================
class F4Storage(BaseStorage):
    def __init__(self, config):
        super(F4Storage, self).__init__(config)

        self.target_url_templ = os.environ['F4_ROOT'] + self.target_url_templ

    def do_upload(self, target_url, full_filename):
        filename = os.path.basename(target_url)

        headers = {'Content-Type': 'application/warc',
                   'Content-Disposition': 'attachment; filename="{0}"'.format(filename)
                  }


        try:
            print('Uploading {0} -> {1}'.format(full_filename, target_url))
            with open(full_filename, 'rb') as fh:
                res = requests.put(target_url, data=fh, headers=headers)
                res.raise_for_status()
            return True
        except Exception as e:
            print(e)
            print('Failed to Upload to {0}'.format(target_url))
            return False

    def is_valid_url(self, target_url):
        try:
            res = requests.head(target_url)
            res.raise_for_status()
            return True
        except Exception as e:
            print(e)
            return False

    def do_delete(self, target_url, client_url):
        try:
            print('Deleting: ' + target_url)
            requests.delete(target_url)
            return True
        except Exception as e:
            print(e)
            return False



