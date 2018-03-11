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


def mock_new_browser(self, url, data):
    TestBrowserInit.browser_redis.hmset('ip:test', data)
    return {'id': data['browser'], 'reqid': 'ABCDEFG'}


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

    @patch('webrecorder.browsermanager.BrowserManager._api_new_browser', mock_new_browser)
    def test_create_remote_browser_for_record(self):
        params = {
            'br': 'chrome:60',

            'user': self.anon_user,
            'coll': 'temp',
            'rec': TestBrowserInit.rec_name,

            'url': 'http://example.com/',
            'mode': 'record'
        }

        res = self.testapp.get('/api/v1/create_remote_browser', params=params)
        assert res.json == {'reqid': 'ABCDEFG',
                            'browser': 'chrome:60',
                            'browser_data': {'name': 'Chrome'},
                            'inactive_time': 60,
                            'ts': '',
                            'url': 'http://example.com/',
                           }

    def test_assert_browser_info(self):
        res = self.browser_redis.hgetall('ip:test')
        assert set(res.keys()) == {'user', 'remote_ip',
                                   'ip', 'id', 'type',
                                   'coll', 'coll_name',
                                   'rec', 'rec_name',
                                   'url', 'request_ts',
                                   'sources', 'inv_sources',
                                   'browser', 'browser_can_write',
                                   'patch_rec',
                                  }


