from .testutils import FullStackTests, FakeStrictRedis

import os
import json

from mock import patch


# ============================================================================
def mock_load_all_browsers(self):
    self.browsers = {
            'chrome:60': {'name': 'Chrome'},
            'firefox:53': {'name': 'Firefox'}
           }


def mock_new_browser(key):
    def do_mock(self, url, data):
        TestBrowserInit.browser_redis.hmset(key, data)
        return {'id': data['browser'], 'reqid': 'ABCDEFG'}

    return do_mock


# ============================================================================
class TestBrowserInit(FullStackTests):
    rec_name = None
    browser_redis = None

    @classmethod
    def setup_class(cls):
        with patch('webrecorder.browsermanager.BrowserManager.load_all_browsers', mock_load_all_browsers):
            super(TestBrowserInit, cls).setup_class()

        cls.browser_redis = FakeStrictRedis.from_url(os.environ['REDIS_BROWSER_URL'], decode_responses=True)

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
                                   'rec', 'rec_name',
                                   'url', 'request_ts',
                                   'sources', 'inv_sources',
                                   'browser', 'browser_can_write',
                                   'patch_rec',
                                  }

    def test_create_browser_for_embed_patch(self):
        params = {
            'user': self.anon_user,
            'coll': 'temp',

            'url': 'http://geocities.com/',
            'timestamp': '1996',

            'mode': 'extract:ia',

            'browser': 'chrome:60',
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
                                   'rec', 'rec_name',
                                   'url', 'request_ts',
                                   'sources', 'inv_sources',
                                   'browser', 'browser_can_write',
                                   'patch_rec',
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
            res = self.testapp.get('/api/v1/create_remote_browser', params=params)

        assert res.json['error']

    def test_create_browser_error_no_rec(self):
        params = {
            'user': self.anon_user,
            'coll': 'temp',

            'url': 'http://geocities.com/',

            'mode': 'record',

            'browser': 'chrome:60',
        }

        with patch('webrecorder.browsermanager.BrowserManager._api_new_browser', mock_new_browser('ip:test3')):
            res = self.testapp.get('/api/v1/create_remote_browser', params=params)

        assert res.json['error']


