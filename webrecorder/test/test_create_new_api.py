from .testutils import FullStackTests
import os


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

    @classmethod
    def teardown_class(cls, *args, **kwargs):
        super(TestCreateNewAPISeparateDomains, cls).teardown_class(*args, **kwargs)
        os.environ['CONTENT_HOST'] = ''
        os.environ['APP_HOST'] = ''

    def test_empty_temp_user(self):
        res = self.testapp.get('/api/v1/load_auth')
        assert res.json['username']
        username = res.json['username']

        res = self.testapp.get('/api/v1/temp-users/' + username)
        assert res.json['username'] == username
        assert res.json['space_utilization']['used'] == 0

    def test_init_anon(self):
        res = self.testapp.get('/api/v1/anon_user', headers={'Host': 'app-host'})
        TestCreateNewAPISeparateDomains.anon_user = res.json['anon_user']

    def test_api_new(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'record'
                 }

        res = self.testapp.post_json('/api/v1/new', params=params, headers={'Host': 'app-host'})

        assert res.json['url'].startswith('http://app-host/{0}/temp/rec-'.format(self.anon_user))
        assert res.json['url'].endswith('/record/http://httpbin.org/get?food=bar')

    def test_api_new_content(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'record',
                  'is_content': True,
                 }

        res = self.testapp.post_json('/api/v1/new', params=params, headers={'Host': 'app-host'})
        assert res.json['url'].startswith('http://content-host/{0}/temp/rec-'.format(self.anon_user))
        assert res.json['url'].endswith('/record/mp_/http://httpbin.org/get?food=bar')


        assert self.testapp.cookies['__test_sesh']
        headers = {'Cookie': '__test_sesh=' + self.testapp.cookies['__test_sesh'],
                   'Host': 'content-host'
                  }

        res = self.testapp.get(res.json['url'], status=200, headers=headers)
        assert '"food": "bar"' in res.text, res.text

    def test_api_new_extract_browser(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'extract:ab',
                  'ts': '19960201',
                  'browser': 'chrome:53',
                  'is_content': True,
                 }

        res = self.testapp.post_json('/api/v1/new', params=params, headers={'Host': 'app-host'})
        assert res.json['url'].startswith('http://app-host/{0}/temp/rec-'.format(self.anon_user))
        assert res.json['url'].endswith('/extract:ab/19960201$br:chrome:53/http://httpbin.org/get?food=bar')

    def test_api_new_patch_ts(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'patch',
                  'ts': '2001',
                 }

        res = self.testapp.post_json('/api/v1/new', params=params, headers={'Host': 'app-host'})
        assert res.json['url'].startswith('http://app-host/{0}/temp/rec-'.format(self.anon_user))
        assert res.json['url'].endswith('/patch/2001/http://httpbin.org/get?food=bar')

    def test_api_temp_user_recs_created(self):
        res = self.testapp.get('/api/v1/temp-users/' + self.anon_user, headers={'Host': 'app-host'})
        assert res.json['rec_count'] == 5

    def test_api_redir_wrong_host(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'record'
                 }

        res = self.testapp.post_json('/api/v1/new', params=params, headers={'Host': 'content-host'}, status=302)
        assert res.location == 'http://app-host/api/v1/new'


# ============================================================================
class TestCreateNewSameDomain(FullStackTests):
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

    def test_api_new_content_with_prefix(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'record',
                  'is_content': True,
                  'prefix': '_',
                 }

        res = self.testapp.post_json('/api/v1/new', params=params)
        assert res.json['url'].startswith('http://localhost:80/_/{0}/temp/rec-'.format(self.anon_user))

