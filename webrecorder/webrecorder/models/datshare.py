import os
import requests
import gevent

from webrecorder.utils import get_bool, spawn_once


# ============================================================================
class DatShare(object):
    DAT_PROP = 'dat_key'
    DAT_COMMITTED_AT = 'dat_committed_at'
    DAT_COLLS = 'h:dat_colls'

    def __init__(self, redis):
        self.redis = redis

        self.dat_enabled = get_bool(os.environ.get('ALLOW_DAT', True))
        self.dat_host = os.environ.get('DAT_SHARE_HOST', 'dat')
        self.dat_port = int(os.environ.get('DAT_SHARE_PORT', 3000))

        self.dat_url = 'http://{dat_host}:{dat_port}'.format(dat_host=self.dat_host,
                                                             dat_port=self.dat_port)

        self.num_shared_dats = self.redis.hlen(self.DAT_COLLS)

        if self.dat_enabled:
            spawn_once(self.dat_check, worker=1)

    def dat_check(self):
        while True:
            try:
                res = requests.get(self.dat_url + '/numDats')
                res.raise_for_status()
                curr_dats = res.json()['num']
            except:
                print('Error reaching dat-share')
                continue

            if curr_dats != self.num_shared_dats:
                print('Actual: {0} != Expected: {1}'.format(curr_dats, self.num_shared_dats))
                self.readd_all()

            gevent.sleep(30)

    def readd_all(self):
        dat_dirs = self.redis.hvals(self.DAT_COLLS)
        res = None
        try:
            data = {'dirs': dat_dirs}
            res = requests.post(self.dat_url + '/sync', json=data)
            res.raise_for_status()
        except Exception as e:
            print(e)
            print('Error bulkShare')
            if res:
                print(res.text)


    def __call__(self, collection, share=True, author=None):
        collection.access.assert_can_admin_coll(collection)

        if not self.dat_enabled:
            return {'error': 'not_supported'}

        if collection.is_external():
            return {'error': 'external_not_allowed'}

        data = {'collDir': collection.get_dir_path()}

        if share:
            cmd = '/share'

            metadata = {'title': collection.get_prop('title')}

            desc = collection.get_prop('desc')
            if desc:
                metadata['description'] = desc

            if author:
                metadata['author'] = author

            data['metadata'] = metadata

        else:
            cmd = '/unshare'

        try:
            res = requests.post(self.dat_url + cmd, json=data)
            res.raise_for_status()
            dat_res = res.json()

            if share:
                collection.set_prop(self.DAT_PROP, dat_res['dat'])
                collection.set_prop(self.DAT_COMMITTED_AT, collection._get_now())

                self.redis.hset(self.DAT_COLLS,
                                collection.my_id,
                                collection.get_dir_path())

            else:
                collection.set_prop(self.DAT_PROP, '')

                self.redis.hdel(self.DAT_COLLS, collection.my_id)

            self.num_shared_dats = self.redis.hlen(self.DAT_COLLS)

        except Exception as e:
            return {'error': str(e)}

        return dat_res


# ============================================================================
dat_share = None


