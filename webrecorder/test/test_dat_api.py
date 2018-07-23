from .testutils import FullStackTests

import os
import time
import json
import yaml

from webrecorder.models.usermanager import CLIUserManager
from webrecorder.models.datshare import DatShare
from webrecorder.utils import get_new_id, today_str
import responses

from itertools import count


# ============================================================================
class TestDatShare(FullStackTests):
    COLL_ID = '100'

    @classmethod
    def setup_class(cls):
        os.environ['AUTO_LOGIN_USER'] = 'test'
        os.environ['ALLOW_DAT'] = '1'
        os.environ['DAT_SYNC_CHECK_TIME'] = '30'

        super(TestDatShare, cls).setup_class(storage_worker=True)

        cls.manager = CLIUserManager()
        cls.set_uuids('Collection', count(int(cls.COLL_ID)))

        cls.dat_info = {'datKey': get_new_id(size=20),
                        'discoveryKey': get_new_id(size=20)
                       }

    @classmethod
    def teardown_class(cls):
        super(TestDatShare, cls).teardown_class()
        os.environ.pop('ALLOW_DAT', '')
        os.environ.pop('AUTO_LOGIN_USER', '')

    def test_create_user_def_coll(self):
        self.manager.create_user('test@example.com', 'test', 'TestTest123', 'archivist', 'Test')
        res = self.testapp.get('/test/default-collection')
        res.charset = 'utf-8'
        assert '"test"' in res.text

    def test_record_1(self):
        res = self.testapp.get('/_new/default-collection/rec/record/mp_/http://httpbin.org/get?food=bar')
        assert res.status_code == 302
        res = res.follow()
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_commit_1(self):
        self.params = {}

        def assert_committed():
            res = self.testapp.post_json('/api/v1/collection/default-collection/commit?user=test', params=self.params)
            self.params = res.json
            assert self.params['success'] == True

        self.sleep_try(0.2, 10.0, assert_committed)

    @responses.activate
    def test_dat_share(self):
        responses.add(responses.POST, 'http://dat:3000/init', status=200,
                      json=self.dat_info)

        responses.add(responses.POST, 'http://dat:3000/share', status=200,
                      json=self.dat_info)

        params = {'collDir': self.warcs_dir}
        res = self.testapp.post_json('/api/v1/collection/default-collection/dat/share?user=test', params=params)
        assert res.json == self.dat_info

        assert len(responses.calls) == 2
        assert responses.calls[0].request.url == 'http://dat:3000/init'
        assert responses.calls[1].request.url == 'http://dat:3000/share'

        today = today_str()
        storage_dir = os.path.join(self.storage_dir, today, self.COLL_ID)

        # test dat.json
        with open(os.path.join(storage_dir, 'dat.json'), 'rt') as fh:
            datjson = json.loads(fh.read())

        assert datjson['url'] == 'dat://' + self.dat_info['datKey']
        assert datjson['author'] == 'Test'
        assert datjson['title'] == 'Default Collection'
        assert datjson['desc'].startswith('*This is your first collection')

        # test metadata.yaml
        with open(os.path.join(storage_dir, 'metadata', 'metadata.yaml'), 'rt') as fh:
            metadata = yaml.load(fh.read())

        assert metadata['collection']
        assert 'pages' in metadata['collection']
        assert 'recordings' in metadata['collection']
        assert 'lists' in metadata['collection']

    @responses.activate
    def test_dat_already_shared(self):
        params = {'collDir': self.warcs_dir}
        res = self.testapp.post_json('/api/v1/collection/default-collection/dat/share?user=test', params=params, status=400)

        assert res.json == {'error': 'already_updated'}

        assert len(responses.calls) == 0

    @responses.activate
    def test_dat_unshare(self):
        responses.add(responses.POST, 'http://dat:3000/unshare', status=200,
                      json={'success': True})

        params = {'collDir': self.warcs_dir}
        res = self.testapp.post_json('/api/v1/collection/default-collection/dat/unshare?user=test', params=params)
        assert res.json == {'success': True}

        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == 'http://dat:3000/unshare'

    @responses.activate
    def test_dat_unshare_not_sharing(self):
        params = {'collDir': self.warcs_dir}
        res = self.testapp.post_json('/api/v1/collection/default-collection/dat/unshare?user=test', params=params)
        assert res.json == {'success': True}

        assert len(responses.calls) == 0

    @responses.activate
    def test_dat_reshare_upstream_api_error(self):
        responses.add(responses.POST, 'http://dat:3000/share', status=400,
                      json={'error': 'unknown'})

        params = {'collDir': self.warcs_dir}
        res = self.testapp.post_json('/api/v1/collection/default-collection/dat/share?user=test', params=params,
                                     status=400)

        assert res.json == {'error': 'api_error'}

        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == 'http://dat:3000/share'

    @responses.activate
    def test_dat_reshare(self):
        responses.add(responses.POST, 'http://dat:3000/share', status=200,
                      json=self.dat_info)

        params = {'collDir': self.warcs_dir}
        res = self.testapp.post_json('/api/v1/collection/default-collection/dat/share?user=test', params=params)
        assert res.json == self.dat_info

        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == 'http://dat:3000/share'

    @responses.activate
    def test_dat_sync_check_in_sync(self):
        responses.add(responses.GET, 'http://dat:3000/numDats', status=200,
                      json={'num': 1})

        DatShare.dat_share.dat_sync()

        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == 'http://dat:3000/numDats'


    @responses.activate
    def test_dat_sync_check_sync_needed(self):
        responses.add(responses.GET, 'http://dat:3000/numDats', status=200,
                      json={'num': 0})

        responses.add(responses.POST, 'http://dat:3000/sync', status=200,
                      json={'results': [self.dat_info]})

        DatShare.dat_share.dat_sync()

        assert len(responses.calls) == 2
        assert responses.calls[0].request.url == 'http://dat:3000/numDats'
        assert responses.calls[1].request.url == 'http://dat:3000/sync'

        body = json.loads(responses.calls[1].request.body.decode('utf-8'))
        assert body == {'dirs': [today_str() + '/' + self.COLL_ID]}


    @responses.activate
    def test_dat_unshare_on_coll_delete(self):
        responses.add(responses.POST, 'http://dat:3000/unshare', status=200,
                      json={'success': True})

        res = self.testapp.delete('/api/v1/collection/default-collection?user=test')
        assert res.json == {'deleted_id': 'default-collection'}

        assert len(responses.calls) == 1
        assert responses.calls[0].request.url == 'http://dat:3000/unshare'

        body = json.loads(responses.calls[0].request.body.decode('utf-8'))
        assert body == {'collDir': today_str() + '/' + self.COLL_ID}

        assert self.redis.hlen(DatShare.DAT_COLLS) == 0

    def test_ensure_coll_delete(self):
        today = today_str()
        storage_dir = os.path.join(self.storage_dir, today, self.COLL_ID)

        def wait_for_del():
            assert not os.path.isdir(storage_dir)

        self.sleep_try(0.1, 2.0, wait_for_del)

