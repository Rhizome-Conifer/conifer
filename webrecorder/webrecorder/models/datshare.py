import os
import requests
import gevent
import json
import yaml

from webrecorder.utils import get_bool, spawn_once
from collections import OrderedDict
from tempfile import NamedTemporaryFile


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
            spawn_once(self.dat_sync_check_loop, worker=1)

    def init_dat(self, collection):
        res = self.dat_share_api('/init', collection)
        return res['datKey']

    def write_dat_json(self, collection, dat_key, author=''):
        if not dat_key:
            dat_key = self.init_dat(collection)

        props = [('url', 'dat://' + dat_key),
                 ('title', collection.get_prop('title')),
                 ('desc', collection.get_prop('desc')),
                 ('author', author)
                ]

        with NamedTemporaryFile('wt', delete=False) as fh:
            fh.write(json.dumps(OrderedDict(props), indent=2, sort_keys=False))

        return fh.name

    def write_metadata_file(self, collection):
        data = {'collection': collection.serialize(include_bookmarks='all-serialize',
                                                   include_files=True)}

        with NamedTemporaryFile('wt', delete=False) as fh:
            yaml.dump(data, fh, default_flow_style=False)

        return fh.name

    def dat_share_api(self, cmd, collection=None, data=None):
        res = None
        try:
            if not data:
                data = {'collDir': collection.get_dir_path()}
            res = requests.post(self.dat_url + cmd, json=data)
            res.raise_for_status()
            return res.json()
        except Exception as e:
            print(e)
            print('API Error: ' + cmd)
            if res:
                print(res.text)

            return None

    def unshare(self, collection):
        if not self.dat_enabled:
            return {'error': 'not_supported'}

        collection.access.assert_can_admin_coll(collection)

        if collection.is_external():
            return {'error': 'external_not_allowed'}

        if not self.is_sharing(collection):
            return {'success': True}

        res = self.dat_share_api('/unshare', collection)

        if res['success'] == True:
            self._mark_unshare(collection)

        return res

    def share(self, collection):
        if not self.dat_enabled:
            return {'error': 'not_supported'}

        collection.access.assert_can_admin_coll(collection)

        if collection.is_external():
            return {'error': 'external_not_allowed'}

        dat_key = collection.get_prop(self.DAT_PROP)
        dat_updated = collection.get_prop(self.DAT_COMMITTED_AT)

        if dat_key and dat_updated and self.is_sharing(collection):
            dat_updated = int(dat_updated)
            last_updated = int(collection.get_prop('updated_at'))

            if last_updated <= dat_updated:
                return {'error': 'already_updated'}

        user = collection.get_owner()
        author = user.get_prop('name') or user.name

        datjson_file = self.write_dat_json(collection, dat_key, author)
        metadata_file = self.write_metadata_file(collection)

        while True:
            done_datjson = collection.commit_file('dat.json', datjson_file, '')
            done_meta = collection.commit_file('metadata.yaml', metadata_file, 'metadata')

            if done_datjson and done_meta:
                break

            print('Waiting for dat.json, metadata commit...')
            time.sleep(10)

        res = self.dat_share_api('/share', collection)

        collection.set_prop(self.DAT_PROP, res['datKey'])
        collection.set_prop(self.DAT_COMMITTED_AT, collection._get_now())

        self._mark_share(collection)

        return res

    def _mark_share(self, collection):
        self.redis.hset(self.DAT_COLLS,
                        collection.my_id,
                        collection.get_dir_path())

        self.num_shared_dats = self.redis.hlen(self.DAT_COLLS)

    def _mark_unshare(self, collection):
        self.redis.hdel(self.DAT_COLLS, collection.my_id)
        self.num_shared_dats = self.redis.hlen(self.DAT_COLLS)

    def is_sharing(self, collection):
        return self.redis.hexists(self.DAT_COLLS, collection.my_id)

    def dat_sync_check_loop(self):
        sleep_time = int(os.environ.get('DAT_SYNC_CHECK_TIME', '30'))
        print('Running Dat Sync Check every {0} seconds'.format(sleep_time))

        while True:
            self.dat_sync()
            gevent.sleep(sleep_time)

    def dat_sync(self):
        try:
            res = requests.get(self.dat_url + '/numDats')
            res.raise_for_status()
            curr_dats = res.json()['num']
        except:
            print('Error reaching dat-share')
            return

        if curr_dats != self.num_shared_dats:
            print('Result: {0} != Expected: {1}'.format(curr_dats, self.num_shared_dats))
            dat_dirs = self.redis.hvals(self.DAT_COLLS)
            print('Resyncing: ', dat_dirs)
            self.dat_share_api('/sync', data={'dirs': dat_dirs})


# ============================================================================
dat_share = None


