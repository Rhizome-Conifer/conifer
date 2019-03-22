from .testutils import FullStackTests, FakeStrictRedis

import os
import json

from mock import patch

from webrecorder.utils import today_str
from webrecorder.models.stats import Stats
from webrecorder.browsermanager import BrowserManager


# ============================================================================
def mock_load_all_browsers(self):
    self.browsers = {
            'chrome:60': {'name': 'Chrome'},
            'firefox:53': {'name': 'Firefox'}
           }


def mock_new_browser(key):
    def do_mock(self, url, data):
        data['reqid'] = 'ABCDEFG'
        TestBrowserInit.browser_redis.hmset(key, data)
        return {'id': data['browser'], 'reqid': 'ABCDEFG'}

    return do_mock

def mock_reqid_to_user_params(self, reqid):
    return TestBrowserInit.browser_redis.hgetall('ip:test')

def mock_browser_sesh_id(self, reqid):
    return


# ============================================================================
@patch('webrecorder.browsermanager.BrowserManager.browser_sesh_id', mock_browser_sesh_id)
class TestBrowserInit(FullStackTests):
    rec_name = None
    browser_redis = None

    @classmethod
    def setup_class(cls):
        with patch('webrecorder.browsermanager.BrowserManager.load_all_browsers', mock_load_all_browsers):
            os.environ['NO_REMOTE_BROWSERS'] = '0'
            super(TestBrowserInit, cls).setup_class()

        cls.browser_redis = FakeStrictRedis.from_url(os.environ['REDIS_BROWSER_URL'], decode_responses=True)

    @classmethod
    def teardown_class(cls):
        os.environ.pop('NO_REMOTE_BROWSERS', '')
        BrowserManager.running = False
        super(TestBrowserInit, cls).teardown_class()

    def test_create_coll_and_rec(self):
        res = self._anon_post('/api/v1/collections?user={user}', params={'title': 'temp'})
        res = self._anon_post('/api/v1/recordings?user={user}&coll=temp')

        assert self.testapp.cookies['__test_sesh'] != ''

        TestBrowserInit.rec_name = res.json['recording']['id']

        assert TestBrowserInit.rec_name

    def test_create_remote_browser_for_record(self):
        params = {
            'browser': 'chrome:60',

            'user': self.anon_user,
            'coll': 'temp',
            'rec': TestBrowserInit.rec_name,

            'url': 'http://example.com/',
            'mode': 'record'
        }

        with patch('webrecorder.browsermanager.BrowserManager._api_new_browser', mock_new_browser('ip:test')):
            res = self.testapp.get('/api/v1/create_remote_browser', params=params)

        assert res.json == {'reqid': 'ABCDEFG',
                            'browser': 'chrome:60',
                            'browser_data': {'name': 'Chrome'},
                            'inactive_time': 60,
                            'timestamp': '',
                            'url': 'http://example.com/',
                           }

        res = self.browser_redis.hgetall('ip:test')
        assert res['request_ts'] == ''
        assert res['sources'] == ''
        assert res['inv_sources'] == ''
        assert res['patch_rec'] == ''
        assert res['type'] == 'record'

        assert set(res.keys()) == {'user', 'remote_ip',
                                   'ip', 'id', 'type',
                                   'coll', 'coll_name',
                                   'rec', 'patch_rec',
                                   'url', 'request_ts',
                                   'sources', 'inv_sources',
                                   'browser', 'browser_can_write',
                                   'reqid',
                                  }

    def test_create_browser_for_embed_patch(self):
        params = {
            'user': self.anon_user,
            'coll': 'temp',

            'url': 'http://geocities.com/',
            'timestamp': '1996',

            'mode': 'extract:ia',

            'browser': 'chrome:60',
            'reqid': 'ABCDEFG',
        }

        res = self.testapp.post_json('/api/v1/new', params=params)
        assert res.json['url']
        assert res.json['rec_name']
        assert res.json['patch_rec_name']

        params['rec'] = res.json['rec_name']
        params['patch_rec'] = res.json['patch_rec_name']

        with patch('webrecorder.browsermanager.BrowserManager._api_new_browser', mock_new_browser('ip:test2')):
            res = self.testapp.get('/api/v1/create_remote_browser', params=params)

        assert res.json == {'reqid': 'ABCDEFG',
                            'browser': 'chrome:60',
                            'browser_data': {'name': 'Chrome'},
                            'inactive_time': 60,
                            'timestamp': '1996',
                            'url': 'http://geocities.com/',
                           }

        res = self.browser_redis.hgetall('ip:test2')
        assert res['request_ts'] == '1996'
        assert res['sources'] == 'ia'
        assert res['inv_sources'] == 'ia'
        assert res['patch_rec'] != ''
        assert res['type'] == 'extract'

        assert set(res.keys()) == {'user', 'remote_ip',
                                   'ip', 'id', 'type',
                                   'coll', 'coll_name',
                                   'rec', 'patch_rec',
                                   'url', 'request_ts',
                                   'sources', 'inv_sources',
                                   'browser', 'browser_can_write',
                                   'reqid',
                                  }

    def test_create_browser_error_invalid_mode(self):
        params = {
            'user': self.anon_user,
            'coll': 'temp',
            'rec': TestBrowserInit.rec_name,

            'url': 'http://geocities.com/',
            'timestamp': '1996',

            'mode': 'foo',

            'browser': 'chrome:60',
        }

        with patch('webrecorder.browsermanager.BrowserManager._api_new_browser', mock_new_browser('ip:test3')):
            res = self.testapp.get('/api/v1/create_remote_browser', params=params, status=400)

        assert res.json['error'] == 'invalid_mode'

    def test_create_browser_error_no_rec(self):
        params = {
            'user': self.anon_user,
            'coll': 'temp',

            'url': 'http://geocities.com/',

            'mode': 'record',

            'browser': 'chrome:60',
        }

        with patch('webrecorder.browsermanager.BrowserManager._api_new_browser', mock_new_browser('ip:test3')):
            res = self.testapp.get('/api/v1/create_remote_browser', params=params, status=404)

        assert res.json['error'] == 'no_such_recording'

    def test_browser_stats(self):
        assert self.redis.keys(Stats.BROWSERS_KEY.format('*')) == [Stats.BROWSERS_KEY.format('chrome:60')]
        assert self.redis.hget(Stats.BROWSERS_KEY.format('chrome:60'), today_str()) == '4'

    def test_record_put_record(self):
        with patch('webrecorder.browsermanager.BrowserManager._api_reqid_to_user_params', mock_reqid_to_user_params):
            res = self.testapp.put('/api/v1/remote/put-record?reqid=ABCDEF&target_uri=custom:///test.txt', params=b'Test Resource\nData',
                                   headers={'Content-Type': 'text/other'})

        assert res.json['WARC-Date']

        # session should not change
        assert 'Set-Cookie' not in res.headers

    def test_replay_resource(self):
        assert self.testapp.cookies['__test_sesh'] != ''

        res = self._anon_get('/{user}/temp/mp_/custom:///test.txt')

        assert res.headers['Content-Type'] == 'text/other'

        assert 'Test Resource\nData' == res.text

