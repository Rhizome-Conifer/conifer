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
        os.environ['SESSION_SHARE_ORIGIN'] = 'http://sharedsession.example.com/'
        kwargs['init_anon'] = False
        super(TestAppContentDomain, cls).setup_class(**kwargs)
        cls.manager = CLIUserManager()

    @classmethod
    def teardown_class(cls, *args, **kwargs):
        super(TestAppContentDomain, cls).teardown_class(*args, **kwargs)
        os.environ['CONTENT_HOST'] = ''
        os.environ['APP_HOST'] = ''
        os.environ['SESSION_SHARE_ORIGIN'] = ''

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

        # don't set max-age for anonymous content session
        assert 'max-age' not in res.headers['Set-Cookie']

        assert res.headers['Location'] == content_host_str

        res = self.content_get(res.headers['Location'])

        assert '"food": "bar"' in res.text

    def test_sest_sesh_custom_redir_url(self):
        res = self.app_get('http://app-host/_set_session?redir_back=http://sharedsession.example.com/custom/path')

        assert res.headers['Location'].startswith('http://sharedsession.example.com/custom/path?redir_back=http://sharedsession.example.com/custom/path&cookie=')

    def test_sest_sesh_wrong_origin(self):
        res = self.app_get('http://app-host/_set_session?redir_back=http://otherurl.example.com/custom/path')

        assert not res.headers['Location'].startswith('http://otherurl.example.com/')

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

    def test_options_set_session_allow_content_domain(self):
        res = self.testapp.options('/_set_session?path=/{user}/temp/http://httpbin.org/'.format(user=self.anon_user),
                                   headers={'Host': 'app-host',
                                            'Origin': 'http://content-host',
                                            'Access-Control-Request-Headers': 'x-pywb-requested-with',
                                            'Access-Control-Request-Method': 'GET'})

        assert res.headers['Access-Control-Allow-Origin'] == 'http://content-host'
        assert res.headers['Access-Control-Allow-Methods'] == 'GET'
        assert res.headers['Access-Control-Allow-Headers'] == 'x-pywb-requested-with'
        assert res.headers['Access-Control-Allow-Credentials'] == 'true'

    def test_options_set_session_dont_allow_wrong_host(self):
        res = self.testapp.options('/_set_session?path=/{user}/temp/http://httpbin.org/'.format(user=self.anon_user),
                                   headers={'Host': 'content-host',
                                            'Origin': 'http://content-host',
                                            'Access-Control-Request-Headers': 'x-pywb-requested-with',
                                            'Access-Control-Request-Method': 'GET'})

        assert 'Access-Control-Allow-Origin' not in res.headers

    def test_options_set_session_dont_allow_wrong_origin(self):
        res = self.testapp.options('/_set_session?path=/{user}/temp/http://httpbin.org/'.format(user=self.anon_user),
                                   headers={'Host': 'app-host',
                                            'Origin': 'http://wrong-host',
                                            'Access-Control-Request-Headers': 'x-pywb-requested-with',
                                            'Access-Control-Request-Method': 'GET'})

        assert 'Access-Control-Allow-Origin' not in res.headers

    def test_options_clear_session_allow_content_domain(self):
        res = self.testapp.options('/_clear_session?json={"foo":"bar"}',
                                   headers={'Host': 'content-host',
                                            'Origin': 'http://app-host',
                                            'Access-Control-Request-Headers': 'x-pywb-requested-with',
                                            'Access-Control-Request-Method': 'GET'})

        assert res.headers['Access-Control-Allow-Origin'] == 'http://app-host'
        assert res.headers['Access-Control-Allow-Methods'] == 'GET'
        assert res.headers['Access-Control-Allow-Headers'] == 'x-pywb-requested-with'
        assert res.headers['Access-Control-Allow-Credentials'] == 'true'

    def test_options_clear_session_dont_allow_wrong_host(self):
        res = self.testapp.options('/_clear_session?json={"foo":"bar"}',
                                   headers={'Host': 'app-host',
                                            'Origin': 'http://content-host',
                                            'Access-Control-Request-Headers': 'x-pywb-requested-with',
                                            'Access-Control-Request-Method': 'GET'})

        assert 'Access-Control-Allow-Origin' not in res.headers

    def test_options_clear_session_dont_allow_wrong_origin(self):
        res = self.testapp.options('/_clear_session?json={"foo":"bar"}',
                                   headers={'Host': 'content-host',
                                            'Origin': 'http://wrong-host',
                                            'Access-Control-Request-Headers': 'x-pywb-requested-with',
                                            'Access-Control-Request-Method': 'GET'})

        assert 'Access-Control-Allow-Origin' not in res.headers

    def test_delete_temp_user(self):
        # ensure cookies cleared on content domain also

        assert len(self.testapp.cookies) == 1
        res = self.testapp.delete('/api/v1/user/{user}'.format(user=self.anon_user),
                                  headers={'Host': 'app-host'})

        assert res.json['deleted_user'] == self.anon_user

        # counts as 1 cookie still
        assert len(self.testapp.cookies) == 1


    def test_create_and_login(self):
        self.manager.create_user('test@example.com', 'test', 'TestTest123', 'archivist', 'Test')

        res = self.testapp.post_json('/api/v1/auth/login',
                                     params={'username': 'test', 'password': 'TestTest123'},
                                     headers={'Host': 'app-host'})

        user = res.json['user']
        assert user['anon'] == False
        assert user['num_collections'] == 1
        assert user['role'] == 'archivist'
        assert user['username'] == 'test'

        assert len(self.testapp.cookies) == 1

        assert self.testapp.cookies['__test_sesh'] != ''

    def test_record_logged_in_app_top_frame(self):
        self.set_uuids('Recording', ['rec'])

        res = self.app_get('/_new/default-collection/rec/record/http://httpbin.org/get?food=bar')
        #assert self.testapp.cookies['__test_sesh'] in res.headers['Set-Cookie']

        res = self.app_get(res.headers['Location'])
        assert res.status_code == 200

        assert 'wbinfo.app_prefix = decodeURI("http://app-host/test/default-collection/rec/record/");' in res.text
        assert 'wbinfo.content_prefix = decodeURI("http://content-host/test/default-collection/rec/record/");' in res.text

    def test_record_logged_in_set_session_content_frame(self):
        res = self.content_get('/test/default-collection/rec/record/mp_/http://httpbin.org/get?food=bar')
        assert res.status_code == 302
        assert 'http://app-host/_set_session' in res.headers['Location']

        res = self.app_get(res.headers['Location'])
        assert res.status_code == 302
        assert 'http://content-host/_set_session' in res.headers['Location']

        res = self.content_get(res.headers['Location'])
        content_host_str = 'http://content-host/test/default-collection/rec/record/mp_/http://httpbin.org/get?food=bar'
        assert res.status_code == 302
        assert self.testapp.cookies['__test_sesh'] in res.headers['Set-Cookie']

        # no max-age for logged in
        assert 'max-age' not in res.headers['Set-Cookie']

        assert res.headers['Location'] == content_host_str

        res = self.content_get(res.headers['Location'])

        assert '"food": "bar"' in res.text

    def test_logout(self):
        assert len(self.testapp.cookies) == 1

        # wrong domain, 403
        res = self.testapp.post_json('/api/v1/auth/logout', status=403)

        # content domain, also wrong, 403
        res = self.testapp.post_json('/api/v1/auth/logout', headers={'Host': 'content-host'}, status=403)

        res = self.testapp.post_json('/api/v1/auth/logout', headers={'Host': 'app-host'})

        assert res.json == {'success': 'logged_out'}

        # content domain cookies still remains
        assert len(self.testapp.cookies) == 1

    def test_content_clear_session(self):
        # wrong host
        self.app_get('/_clear_session', status=400)

        headers = {'Host': 'content-host',
                   'Origin': 'http://app-host'
                  }

        # clear session ok
        res = self.testapp.get('/_clear_session', headers=headers)

        assert res.json == {'success': 'logged_out'}

        assert len(self.testapp.cookies) == 0
        assert 'HttpOnly' in res.headers['Set-Cookie']
        assert '__test_sesh' not in self.testapp.cookies

        assert res.headers['Access-Control-Allow-Origin'] == 'http://app-host'
        assert res.headers['Access-Control-Allow-Credentials'] == 'true'

    def test_login_and_replay(self):
        res = self.testapp.post_json('/api/v1/auth/login',
                                     params={'username': 'test', 'password': 'TestTest123'},
                                     headers={'Host': 'app-host'})


        assert res.json['user']['username'] == 'test'

        res = self.app_get('/test/default-collection/http://httpbin.org/get?food=bar', status=200)

        res = self.content_get('/test/default-collection/mp_/http://httpbin.org/get?food=bar', status=302)
        assert 'http://app-host/_set_session' in res.headers['Location']

        res = self.app_get(res.headers['Location'], status=302)
        assert 'http://content-host/_set_session' in res.headers['Location']

        res = self.content_get(res.headers['Location'])
        content_host_str = 'http://content-host/test/default-collection/mp_/http://httpbin.org/get?food=bar'
        assert res.status_code == 302
        assert self.testapp.cookies['__test_sesh'] in res.headers['Set-Cookie']

        # no max-age for logged in
        assert 'max-age' not in res.headers['Set-Cookie']

        assert res.headers['Location'] == content_host_str

        res = self.content_get(res.headers['Location'])

        assert '"food": "bar"' in res.text

    def test_wipe_app_cookie(self):
        # remove app-domain cookie
        self.testapp.cookiejar.clear(domain='app-host.local')

        # new session -- logged in user no longer avail
        res = self.app_get('/test/default-collection/http://httpbin.org/get?food=bar', status=404)

        res = self.content_get('/test/default-collection/mp_/http://httpbin.org/get?food=bar', status=200)

        # create new temp session
        self.set_uuids('Recording', ['recx'])

        res = self.app_get('/_new/temp/recx/record/http://httpbin.org/get?food=bar', status=302)
        top_path = res.headers['Location']
        res = self.app_get(top_path, status=200)

        res = self.app_get('/api/v1/auth/curr_user')
        TestAppContentDomain.anon_user = res.json['user']['username']
        TestAppContentDomain.top_path = top_path

        assert '/' + self.anon_user + '/' in top_path

    def test_reset_content_cookie_record(self):
        # 404, wrong content cookie
        res = self.testapp.get('/{user}/temp/recx/record/mp_/http://httpbin.org/get?food=bar'.format(user=self.anon_user),
                               headers={'Host': 'content-host',
                                        'Referer': self.top_path}, status=307)

        assert 'http://app-host/_set_session' in res.headers['Location']

        assert 'content_cookie' in res.headers['Location']

        res = self.app_get(res.headers['Location'], status=302)
        assert 'http://content-host/_set_session' in res.headers['Location']

        res = self.content_get(res.headers['Location'], status=302)

        content_host_str = 'http://content-host/{user}/temp/recx/record/mp_/http://httpbin.org/get?food=bar'.format(user=self.anon_user)

        assert self.testapp.cookies['__test_sesh'] in res.headers['Set-Cookie']

        assert res.headers['Location'] == content_host_str

        res = self.content_get(res.headers['Location'])

        assert '"food": "bar"' in res.text

    def test_wipe_app_cookie_2_login(self):
        # remove app-domain cookie
        self.testapp.cookiejar.clear(domain='app-host.local')

        res = self.testapp.post_json('/api/v1/auth/login',
                                     params={'username': 'test', 'password': 'TestTest123'},
                                     headers={'Host': 'app-host'})


        assert res.json['user']['username'] == 'test'

    def test_reset_content_cookie_replay_ts(self):
        url = '/test/default-collection/2018mp_/http://httpbin.org/get?food=bar'
        res = self.testapp.get(url,
                               headers={'Host': 'content-host',
                                        'Referer': 'http://app-host/'})

        assert 'http://app-host/_set_session' in res.headers['Location']

        assert 'content_cookie' in res.headers['Location']

        res = self.app_get(res.headers['Location'], status=302)
        assert 'http://content-host/_set_session' in res.headers['Location']

        res = self.content_get(res.headers['Location'])
        content_host_str = 'http://content-host/test/default-collection/2018mp_/http://httpbin.org/get?food=bar'
        assert res.status_code == 302
        assert self.testapp.cookies['__test_sesh'] in res.headers['Set-Cookie']

    def test_not_found(self):
        url = '/test/default-collection/mp_/http://httpbin.org/get?bood=far'
        refer_url = 'http://app-host' + url.replace('mp_/', '')

        res = self.testapp.get(url,
                               headers={'Host': 'content-host',
                                        'Referer': refer_url},
                               status=404)

    def test_not_found_no_cookie(self):
        # clear content cookie
        self.testapp.cookiejar.clear(domain='content-host.local')

        url = '/test/default-collection/mp_/http://httpbin.org/get?bood=far'
        refer_url = 'http://app-host' + url.replace('mp_/', '')

        res = self.testapp.get(url,
                               headers={'Host': 'content-host',
                                        'Referer': refer_url},
                               status=302)

        assert 'content_cookie' not in res.headers['Location']

        # app /_set_session
        res = self.app_get(res.headers['Location'])

        assert 'Set-Cookie' not in res.headers

        # content /_set_session
        res = self.content_get(res.headers['Location'])

        assert res.headers['Location'].endswith(url)

        res = self.testapp.get(res.headers['Location'],
                               headers={'Host': 'content-host',
                                        'Referer': refer_url},
                               status=404)

    def test_not_found_coll_no_cookie(self):
        # clear content cookie
        self.testapp.cookiejar.clear(domain='content-host.local')

        url = '/test/default-collection-invalid/mp_/http://httpbin.org/get?bood=far'
        refer_url = 'http://app-host' + url.replace('mp_/', '')

        res = self.testapp.get(url,
                               headers={'Host': 'content-host',
                                        'Referer': refer_url},
                               status=302)

        assert 'content_cookie' not in res.headers['Location']
        assert 'Set-Cookie' not in res.headers

        # app /_set_session
        res = self.app_get(res.headers['Location'])

        assert 'Set-Cookie' not in res.headers

        # content /_set_session
        res = self.content_get(res.headers['Location'])

        assert res.headers['Location'].endswith(url)

        res = self.testapp.get(res.headers['Location'],
                               headers={'Host': 'content-host',
                                        'Referer': refer_url},
                               status=307)

        assert 'app-host' in res.headers['Location']
        res = self.app_get(res.headers['Location'])

        assert 'content-host' in res.headers['Location']
        res = self.content_get(res.headers['Location'], status=404)

    def test_public_no_cookie_needed(self):
        params = {'public': True,
                 }

        res = self.testapp.post_json('/api/v1/collection/default-collection?user=test',
                            headers={'Host': 'app-host'},
                            params=params, status=200)

        # clear content cookie
        self.testapp.cookiejar.clear(domain='content-host.local')

        url = '/test/default-collection/2018mp_/http://httpbin.org/get?food=bar'
        refer_url = 'http://app-host' + url.replace('mp_/', '/')
        res = self.testapp.get(url,
                               headers={'Host': 'content-host',
                                        'Referer': refer_url}, status=200)

        assert 'Set-Cookie' in res.headers
        assert '"food": "bar"' in res.text

