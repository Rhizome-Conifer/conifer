from .testutils import FullStackTests
import os
from itertools import count


# ============================================================================
class TestCreateNewAPISeparateDomains(FullStackTests):
    runner_env_params = {'TEMP_SLEEP_CHECK': '1',
                         'APP_HOST': 'app-host',
                         'CONTENT_HOST': 'content-host'}
    @classmethod
    def setup_class(cls, **kwargs):
        os.environ['CONTENT_HOST'] = 'content-host'
        os.environ['APP_HOST'] = 'app-host'
        kwargs['init_anon'] = False
        super(TestCreateNewAPISeparateDomains, cls).setup_class(**kwargs)
        cls.set_uuids('Recording', ('rec-' + chr(ord('A') + c) for c in count()))

    @classmethod
    def teardown_class(cls, *args, **kwargs):
        super(TestCreateNewAPISeparateDomains, cls).teardown_class(*args, **kwargs)
        os.environ['CONTENT_HOST'] = ''
        os.environ['APP_HOST'] = ''

    def test_new_temp_user_wrong_host(self):
        res = self.testapp.post('/api/v1/auth/anon_user', headers={'Host': 'app-host'})
        assert res.json['user']['username']
        username = res.json['user']['username']

        self.assert_temp_user_sesh(username)

        # incorrect host, redirect
        res = self.testapp.get('/api/v1/user/' + username, status=302)
        assert res.headers['Location'] == 'http://app-host/api/v1/user/' + username

    def test_init_anon(self):
        res = self.testapp.post('/api/v1/auth/anon_user', headers={'Host': 'app-host'})
        TestCreateNewAPISeparateDomains.anon_user = res.json['user']['username']

        self.assert_temp_user_sesh(TestCreateNewAPISeparateDomains.anon_user)

        assert res.json['user']['username'] == self.anon_user
        assert res.json['user']['space_utilization']['used'] == 0
        assert res.json['user']['ttl']

    def test_api_new(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'record'
                 }

        res = self.testapp.post_json('/api/v1/new', params=params, headers={'Host': 'app-host'})

        assert res.json['url'].startswith('http://app-host/{0}/temp/rec-'.format(self.anon_user))
        assert res.json['url'].endswith('/record/http://httpbin.org/get?food=bar')
        assert res.json['rec_name'] != ''
        assert res.json['patch_rec_name'] == ''

    def test_api_new_content(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'record',
                  'is_content': True,
                  'desc': 'Rec Session Description Here',
                 }

        res = self.testapp.post_json('/api/v1/new', params=params, headers={'Host': 'app-host'})
        assert res.json['url'].startswith('http://content-host/{0}/temp/rec-'.format(self.anon_user))
        assert res.json['url'].endswith('/record/mp_/http://httpbin.org/get?food=bar')

        rec = res.json['rec_name']

        assert self.testapp.cookies['__test_sesh']
        headers = {'Cookie': '__test_sesh=' + self.testapp.cookies['__test_sesh'],
                   'Host': 'content-host'
                  }

        res = self.testapp.get(res.json['url'], status=200, headers=headers)
        assert '"food": "bar"' in res.text, res.text

        res = self.testapp.get('/api/v1/recording/{rec}?coll=temp&user={user}'.format(rec=rec, user=self.anon_user),
                               headers={'Host': 'app-host'})

        assert res.json['recording']['desc'] == 'Rec Session Description Here'

    def test_api_new_extract_browser(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'extract:ab',
                  'timestamp': '19960201',
                  'browser': 'chrome:53',
                  'is_content': True,
                 }

        res = self.testapp.post_json('/api/v1/new', params=params, headers={'Host': 'app-host'})
        assert res.json['url'].startswith('http://app-host/{0}/temp/rec-'.format(self.anon_user))
        assert res.json['url'].endswith('/extract:ab/19960201$br:chrome:53/http://httpbin.org/get?food=bar')
        assert res.json['rec_name'] != ''
        assert res.json['patch_rec_name'] != ''

    def test_api_new_patch_ts(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'patch',
                  'timestamp': '2001',
                 }

        res = self.testapp.post_json('/api/v1/new', params=params, headers={'Host': 'app-host'})
        assert res.json['url'].startswith('http://app-host/{0}/temp/rec-'.format(self.anon_user))
        assert res.json['url'].endswith('/patch/2001/http://httpbin.org/get?food=bar')
        assert res.json['rec_name'] != ''
        assert res.json['patch_rec_name'] == ''

    def test_api_temp_user_recs_created(self):
        res = self.testapp.get('/api/v1/user/' + self.anon_user, headers={'Host': 'app-host'})
        assert res.json['user']['num_recordings'] == 5

    def test_api_redir_wrong_host(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'record'
                 }

        res = self.testapp.post_json('/api/v1/new', params=params, headers={'Host': 'content-host'}, status=302)
        assert res.location == 'http://app-host/api/v1/new'


# ============================================================================
class TestCreateNewSameDomain(FullStackTests):
    @classmethod
    def setup_class(cls, **kwargs):
        super(TestCreateNewSameDomain, cls).setup_class(**kwargs)
        cls.set_uuids('Recording', ('rec-' + chr(ord('A') + c) for c in count()))

    def test_api_new(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'record'
                 }

        res = self.testapp.post_json('/api/v1/new', params=params)

        assert res.json['url'].startswith('http://localhost:80/{0}/temp/rec-'.format(self.anon_user))
        assert res.json['url'].endswith('/record/http://httpbin.org/get?food=bar')

    def test_api_new_content(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'record',
                  'is_content': True,
                 }

        res = self.testapp.post_json('/api/v1/new', params=params)
        assert res.json['url'].startswith('http://localhost:80/{0}/temp/rec-'.format(self.anon_user))
        assert res.json['url'].endswith('/record/mp_/http://httpbin.org/get?food=bar')

        assert self.testapp.cookies['__test_sesh']
        res = self.testapp.get(res.json['url'], status=200)
        assert '"food": "bar"' in res.text, res.text

