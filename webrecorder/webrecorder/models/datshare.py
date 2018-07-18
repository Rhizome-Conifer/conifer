import os
import requests

from webrecorder.utils import get_bool


# ============================================================================
class DatShare(object):
    def __init__(self):
        self.dat_enabled = get_bool(os.environ.get('ALLOW_DAT', True))
        self.dat_host = os.environ.get('DAT_SHARE_HOST', 'dat')
        self.dat_port = int(os.environ.get('DAT_SHARE_PORT', 3000))

        self.dat_url = 'http://{dat_host}:{dat_port}'.format(dat_host=self.dat_host,
                                                             dat_port=self.dat_port)

    def __call__(self, user, collection, share=True):
        collection.access.assert_can_admin_coll(collection)

        if not self.dat_enabled:
            return {'error': 'not_supported'}

        if collection.is_external():
            return {'error': 'external_not_allowed'}

        data = {'collDir': collection.get_dir_path()}

        if share:
            cmd = '/share'

            metadata = {'title': collection.get_prop('title'),
                        'author': user.name,
                       }

            desc = collection.get_prop('desc')
            if desc:
                metadata['description'] = desc

            data['metadata'] = metadata

        else:
            cmd = '/unshare'

        try:
            res = requests.post(self.dat_url + cmd, json=data)
            res.raise_for_status()
            dat_res = res.json()
            if share:
                collection.dat_share(dat_res['dat'])
            else:
                collection.dat_unshare()

        except Exception as e:
            return {'error': str(e)}

        return dat_res

    def remove_only(self, data):
        if not self.dat_enabled:
            return False

        try:
            data = {'collDir': collection.get_dir_path()}
            res = requests.post(self.dat_url + '/unshare', json=data)
        except Exception as e:
            print(e)
            return False

        return True


