from .testutils import FullStackTests
import os
import re
import json

from urllib.parse import urlencode
from webrecorder.models.usermanager import CLIUserManager


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
        cls.manager = CLIUserManager()

    @classmethod
    def teardown_class(cls, *args, **kwargs):
        super(TestAppContentDomain, cls).teardown_class(*args, **kwargs)
        os.environ['CONTENT_HOST'] = ''
        os.environ['APP_HOST'] = ''

    def app_get(self, url, status=None):
        url = url.format(user=self.anon_user)
        headers = {'Host': 'app-host'}
        return self.testapp.get(url, headers={'Host': 'app-host'}, status=status)

    def content_get(self, url, status=None):
        url = url.format(user=self.anon_user)
        return self.testapp.get(url, headers={'Host': 'content-host'}, status=status)

    def test_home_page_redir_to_app(self):
        res = self.content_get('/')
        assert res.status_code == 302
        assert res.headers['Location'] == 'http://app-host/'

    def test_record_app_top_frame(self):
        self.set_uuids('Recording', ['rec'])

        res = self.app_get('/_new/temp/rec/record/http://httpbin.org/get?food=bar')
        assert self.testapp.cookies['__test_sesh'] in res.headers['Set-Cookie']

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

    def test_delete_temp_user(self):
        # ensure cookies cleared on content domain also

        assert len(self.testapp.cookies) == 1
        res = self.testapp.delete('/api/v1/user/{user}'.format(user=self.anon_user),
                                  headers={'Host': 'app-host'}, status=303)

        # counts as 1 cookie still
        assert len(self.testapp.cookies) == 1

        redirect_url  = 'http://content-host/_clear_session?' + urlencode({'json': json.dumps({'deleted_user': self.anon_user})})
        assert res.headers['Location'] == redirect_url

        # adding header to use content-host not content-host:80
        res = res.follow(headers={'Host': 'content-host'})

        assert res.json['deleted_user'] == self.anon_user

        assert res.headers['Set-Cookie']

        assert len(self.testapp.cookies) == 0

    def test_create_login(self):
        self.manager.create_user('test@example.com', 'test', 'TestTest123', 'archivist', 'Test')

        assert len(self.testapp.cookies) == 0

        res = self.testapp.post_json('/api/v1/auth/login',
                                     params={'username': 'test', 'password': 'TestTest123'},
                                     headers={'Host': 'app-host'}, status=303)

        # adding header to use content-host not content-host:80
        res = res.follow(headers={'Host': 'content-host'})

        assert res.json == {'anon': False, 'coll_count': 1, 'role': 'archivist', 'username': 'test'}

        assert len(self.testapp.cookies) == 1

        assert self.testapp.cookies['__test_sesh'] != ''


    def test_logout(self):
        assert len(self.testapp.cookies) == 1

        # wrong domain, 403
        res = self.testapp.post_json('/api/v1/auth/logout', status=403)

        # content domain, also wrong, 403
        res = self.testapp.post_json('/api/v1/auth/logout', headers={'Host': 'content-host'}, status=403)


        assert len(self.testapp.cookies) == 1

        res = self.testapp.post_json('/api/v1/auth/logout', headers={'Host': 'app-host'}, status=303)

        # adding header to use content-host not content-host:80
        res = res.follow(headers={'Host': 'content-host'})

        assert res.json['success'] == 'logged_out'

        assert len(self.testapp.cookies) == 0
        assert '__test_sesh' not in self.testapp.cookies

    def test_content_clear_session(self):
        # wrong host
        self.app_get('/_clear_session', status=400)

        # no json block, correct host
        self.content_get('/_clear_session?json=xyz', status=400)

        # clear session ok
        res = self.content_get('/_clear_session?json=%7B%22foo%22%3A%20%22bar%22%7D', status=200)

        assert res.json == {'foo': 'bar'}
