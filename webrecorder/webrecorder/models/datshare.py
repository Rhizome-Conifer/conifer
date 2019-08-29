import os
import requests
import gevent
import json
import yaml
from datetime import datetime

from webrecorder.utils import get_bool, spawn_once
from collections import OrderedDict
from tempfile import NamedTemporaryFile


# ============================================================================
class DatShare(object):
    DAT_KEY_PROP = 'dat_key'
    DAT_SHARE = 'dat_share'
    DAT_UPDATED_AT = 'dat_updated_at'
    DAT_COLLS = 'h:dat_colls'

    dat_share = None

    def __init__(self, redis):
        self.redis = redis

        self.dat_enabled = get_bool(os.environ.get('ALLOW_DAT', False))
        self.dat_host = os.environ.get('DAT_SHARE_HOST', 'dat')
        self.dat_port = int(os.environ.get('DAT_SHARE_PORT', 3000))

        self.dat_url = 'http://{dat_host}:{dat_port}'.format(dat_host=self.dat_host,
                                                             dat_port=self.dat_port)

        self.running = True

        if self.dat_enabled:
            spawn_once(self.dat_sync_check_loop, worker=1)

    def close(self):
        self.running = False

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
                                                   include_pages=False,
                                                   include_rec_pages=True,
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
                return {'error': res.text}

            return {'error': str(e)}

    def unshare(self, collection):
        if not self.dat_enabled:
            return {'error': 'not_supported'}

        collection.access.assert_can_admin_coll(collection)

        if collection.is_external():
            return {'error': 'external_not_allowed'}

        if collection.get_owner().is_anon():
            return {'error': 'not_logged_in'}

        dat_key = collection.get_prop(self.DAT_KEY_PROP)
        dat_updated_at = collection.get_prop(self.DAT_UPDATED_AT)

        if self.is_sharing(collection):
            res = self.dat_share_api('/unshare', collection)

            if res and res.get('success') == True:
                self._mark_unshare(collection)

        if dat_updated_at:
            dat_updated_at = collection.to_iso_date(dat_updated_at)

        return {'dat_key': dat_key,
                'dat_updated_at': dat_updated_at,
                'dat_share': collection.get_bool_prop('dat_share')
               }

    def share(self, collection, always_update=False):
        if not self.dat_enabled:
            return {'error': 'not_supported'}

        collection.access.assert_can_admin_coll(collection)

        if collection.is_external():
            return {'error': 'external_not_allowed'}

        user = collection.get_owner()

        if user.is_anon():
            return {'error': 'not_logged_in'}

        dat_key = collection.get_prop(self.DAT_KEY_PROP)
        dat_updated = collection.get_prop(self.DAT_UPDATED_AT)

        if dat_key and dat_updated and self.is_sharing(collection):
            dat_updated = int(dat_updated)
            last_updated = int(collection.get_prop('updated_at'))

            if last_updated <= dat_updated:
                if not always_update:
                    return {'error': 'already_updated'}

        author = user.get_prop('full_name') or user.name

        commit_id = collection.commit_all()

        datjson_file = self.write_dat_json(collection, dat_key, author)
        metadata_file = self.write_metadata_file(collection)

        while self.running:
            done_datjson = collection.commit_file('dat.json', datjson_file, '')
            done_meta = collection.commit_file('metadata.yaml', metadata_file, 'metadata')

            if commit_id:
                commit_id = collection.commit_all(commit_id)

            if done_datjson and done_meta and not commit_id:
                break

            print('Waiting for collection, dat.json, metadata commit...')
            gevent.sleep(10)

        res = self.dat_share_api('/share', collection)

        now = datetime.utcnow()

        collection.set_prop(self.DAT_KEY_PROP, res['datKey'])
        collection.set_prop(self.DAT_UPDATED_AT, int(now.timestamp()))

        self._mark_share(collection)

        return {'dat_key': res['datKey'],
                'dat_updated_at': now.isoformat(),
                'dat_share': True
               }

    def _mark_share(self, collection):
        self.redis.hset(self.DAT_COLLS,
                        collection.my_id,
                        collection.get_dir_path())

        collection.set_bool_prop(self.DAT_SHARE, True)

    def _mark_unshare(self, collection):
        self.redis.hdel(self.DAT_COLLS, collection.my_id)

        collection.set_bool_prop(self.DAT_SHARE, False)

    def is_sharing(self, collection):
        return self.redis.hexists(self.DAT_COLLS, collection.my_id)

    def dat_sync_check_loop(self):
        sleep_time = int(os.environ.get('DAT_SYNC_CHECK_TIME', '30'))
        print('Running Dat Sync Check every {0} seconds'.format(sleep_time))

        while self.running:
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

        num_shared_dats = self.redis.hlen(self.DAT_COLLS)

        if curr_dats != num_shared_dats:
            print('Result: {0} != Expected: {1}'.format(curr_dats, num_shared_dats))
            dat_dirs = self.redis.hvals(self.DAT_COLLS)
            print('Resyncing: ', dat_dirs)
            self.dat_share_api('/sync', data={'dirs': dat_dirs})


