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
        res = self.app_get('/_new/temp/rec/record/http://httpbin.org/get?food=bar')
        res = self.app_get(res.headers['Location'])
        assert res.status_code == 200

        m = re.search('temp-[\w\d]+', res.text)
        TestAppContentDomain.anon_user = m.group(0)

        content_host_str = 'http://content-host/{user}/temp/rec/record/mp_/http://httpbin.org/get?food=bar'.format(user=self.anon_user)
        assert content_host_str in res.text

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
        assert 'http://content-host/{user}/temp/mp_/http://httpbin.org/get?food=bar'.format(user=self.anon_user) in res.text

    def test_replay_content_frame(self):
        res = self.content_get('/{user}/temp/mp_/http://httpbin.org/get?food=bar')
        assert '"food": "bar"' in res.text

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

