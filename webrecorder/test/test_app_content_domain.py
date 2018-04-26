from .testutils import FullStackTests
import os
import re


# ============================================================================
class TestAppContentDomain(FullStackTests):
    """
    Tests for separate app/content domain deployment
    """
    runner_env_params = {'TEMP_SLEEP_CHECK': '1',
                         'APP_HOST': 'app-host',
                         'CONTENT_HOST': 'content-host'}
    anon_user = None

    @classmethod
    def setup_class(cls, **kwargs):
        os.environ['CONTENT_HOST'] = 'content-host'
        os.environ['APP_HOST'] = 'app-host'
        kwargs['init_anon'] = False
        super(TestAppContentDomain, cls).setup_class(**kwargs)

    @classmethod
    def teardown_class(cls, *args, **kwargs):
        super(TestAppContentDomain, cls).teardown_class(*args, **kwargs)
        os.environ['CONTENT_HOST'] = ''
        os.environ['APP_HOST'] = ''

    def app_get(self, url):
        url = url.format(user=self.anon_user)
        headers = {'Host': 'app-host'}
        return self.testapp.get(url, headers={'Host': 'app-host'})

    def content_get(self, url):
        url = url.format(user=self.anon_user)
        return self.testapp.get(url, headers={'Host': 'content-host'})

    def test_home_page_redir_to_app(self):
        res = self.content_get('/')
        assert res.status_code == 302
        assert res.headers['Location'] == 'http://app-host/'

    def test_record_app_top_frame(self):
        self.set_uuids('Recording', ['rec'])
        res = self.app_get('/_new/temp/rec/record/http://httpbin.org/get?food=bar')
        res = self.app_get(res.headers['Location'])
        assert res.status_code == 200

        m = re.search('temp-[\w\d]+', res.text)
        TestAppContentDomain.anon_user = m.group(0)

        assert 'wbinfo.app_prefix = decodeURI("http://app-host/{user}/temp/rec/record/");'.format(user=self.anon_user) in res.text
        assert 'wbinfo.content_prefix = decodeURI("http://content-host/{user}/temp/rec/record/");'.format(user=self.anon_user) in res.text

    def test_record_set_session_content_frame(self):
        res = self.content_get('/{user}/temp/rec/record/mp_/http://httpbin.org/get?food=bar')
        assert res.status_code == 302
        assert 'http://app-host/_set_session' in res.headers['Location']

        res = self.app_get(res.headers['Location'])
        assert res.status_code == 302
        assert 'http://content-host/_set_session' in res.headers['Location']

        res = self.content_get(res.headers['Location'])
        content_host_str = 'http://content-host/{user}/temp/rec/record/mp_/http://httpbin.org/get?food=bar'.format(user=self.anon_user)
        assert res.status_code == 302
        assert self.testapp.cookies['__test_sesh'] in res.headers['Set-Cookie']
        assert res.headers['Location'] == content_host_str

        res = self.content_get(res.headers['Location'])

        assert '"food": "bar"' in res.text

    def test_replay_app_frame(self):
        res = self.app_get('/{user}/temp/http://httpbin.org/get?food=bar')
        assert res.headers.get('Content-Security-Policy') == None

        assert 'wbinfo.app_prefix = decodeURI("http://app-host/{user}/temp/");'.format(user=self.anon_user) in res.text
        assert 'wbinfo.content_prefix = decodeURI("http://content-host/{user}/temp/");'.format(user=self.anon_user) in res.text

    def test_replay_content_frame(self):
        res = self.content_get('/{user}/temp/mp_/http://httpbin.org/get?food=bar')
        assert '"food": "bar"' in res.text

        csp = "default-src 'unsafe-eval' 'unsafe-inline' 'self' data: blob: mediastream: ws: wss: app-host/_set_session; form-action 'self'"
        assert res.headers['Content-Security-Policy'] == csp

    def test_redir_to_content_frame(self):
        res = self.app_get('/{user}/temp/mp_/http://httpbin.org/get?food=bar')
        assert res.status_code == 302
        assert res.headers['Location'] == 'http://content-host/{user}/temp/mp_/http://httpbin.org/get?food=bar'.format(user=self.anon_user)

    def test_redir_to_app_frame(self):
        res = self.content_get('/{user}/temp/http://httpbin.org/get?food=bar')
        assert res.status_code == 302
        assert res.headers['Location'] == 'http://app-host/{user}/temp/http://httpbin.org/get?food=bar'.format(user=self.anon_user)

    def test_app_coll_page(self):
        res = self.app_get('/{user}/temp/'.format(user=self.anon_user))
        assert res.status_code == 200

    def test_content_redir_to_app_user_page(self):
        res = self.content_get('/{user}'.format(user=self.anon_user))
        assert res.status_code == 302
        assert res.headers['Location'] == 'http://app-host/{user}'.format(user=self.anon_user)

    def test_content_redir_to_app_coll_page(self):
        res = self.content_get('/{user}/temp/'.format(user=self.anon_user))
        assert res.status_code == 302
        assert res.headers['Location'] == 'http://app-host/{user}/temp/'.format(user=self.anon_user)

    def test_options_allow_content_domain_set_session(self):
        res = self.testapp.options('/_set_session?path=/{user}/temp/http://httpbin.org/'.format(user=self.anon_user),
                                   headers={'Host': 'app-host',
                                            'Origin': 'http://content-host/',
                                            'Access-Control-Request-Headers': 'x-pywb-requested-with',
                                            'Access-Control-Request-Method': 'GET'})

        assert res.headers['Access-Control-Allow-Origin'] == 'http://content-host/'
        assert res.headers['Access-Control-Allow-Methods'] == 'GET'
        assert res.headers['Access-Control-Allow-Headers'] == 'x-pywb-requested-with'
        assert res.headers['Access-Control-Allow-Credentials'] == 'true'

    def test_options_dont_allow_wrong_host(self):
        res = self.testapp.options('/_set_session?path=/{user}/temp/http://httpbin.org/'.format(user=self.anon_user),
                                   headers={'Host': 'content-host',
                                            'Origin': 'http://content-host/',
                                            'Access-Control-Request-Headers': 'x-pywb-requested-with',
                                            'Access-Control-Request-Method': 'GET'})

        assert 'Access-Control-Allow-Origin' not in res.headers

    def test_options_dont_allow_wrong_origin(self):
        res = self.testapp.options('/_set_session?path=/{user}/temp/http://httpbin.org/'.format(user=self.anon_user),
                                   headers={'Host': 'app-host',
                                            'Origin': 'http://wrong-host/',
                                            'Access-Control-Request-Headers': 'x-pywb-requested-with',
                                            'Access-Control-Request-Method': 'GET'})

        assert 'Access-Control-Allow-Origin' not in res.headers


