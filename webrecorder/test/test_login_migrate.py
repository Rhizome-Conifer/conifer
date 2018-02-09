from .testutils import FullStackTests

import os
import webtest

from webrecorder.models.usermanager import CLIUserManager


# ============================================================================
class TestLoginMigrate(FullStackTests):
    @classmethod
    def setup_class(cls, **kwargs):
        super(TestLoginMigrate, cls).setup_class(storage_worker=True)

        cls.user_manager = CLIUserManager()

    def test_record_1(self):
        res = self.testapp.get('/_new/temp/rec/record/mp_/http://httpbin.org/get?food=bar')
        assert res.status_code == 302
        res = res.follow()
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        res = self.testapp.get('/api/v1/curr_user')
        assert res.json == {'curr_user': self.anon_user}

    def test_warcs_in_temp_dir(self):
        user_dir = os.path.join(self.warcs_dir, self.anon_user)

        def assert_one_dir():
            assert len(os.listdir(user_dir)) == 1

        self.sleep_try(0.1, 10.0, assert_one_dir)

    def test_create_user_def_coll(self):
        self.user_manager.create_user('test@example.com', 'test', 'TestTest123', 'archivist', 'Test')
        res = self.testapp.get('/test/default-collection')
        res.charset = 'utf-8'
        assert '"test"' in res.text

    def test_login_fail(self):
        params = {'username': 'test',
                  'password': 'TestTest123',

                  #'to-coll': 'Test Migrate',
                  'move-temp': '1'
                 }

        res = self.testapp.post('/_login', params=params)

        assert res.headers['Location'] == 'http://localhost:80/_login'
        assert self.testapp.cookies.get('__test_sesh', '') != ''

        res = self.testapp.get('/api/v1/curr_user')
        assert res.json == {'curr_user': self.anon_user}

    def test_login(self):
        params = {'username': 'test',
                  'password': 'TestTest123',

                  'to-coll': 'Test Migrate',
                  'move-temp': '1'
                 }

        res = self.testapp.post('/_login', params=params)

        assert res.headers['Location'] == 'http://localhost:80/test'
        assert self.testapp.cookies.get('__test_sesh', '') != ''

        res = self.testapp.get('/api/v1/curr_user')
        assert res.json == {'curr_user': 'test'}

    def test_login_replay(self):
        res = self.testapp.get('/test/test-migrate/mp_/http://httpbin.org/get?food=bar')

        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        res = self.testapp.get('/api/v1/curr_user')
        assert res.json == {'curr_user': 'test'}

    def test_warcs_in_user_dir(self):
        user_dir = os.path.join(self.warcs_dir, 'test')

        def assert_one_dir():
            assert len(os.listdir(user_dir)) == 1

        self.sleep_try(0.1, 10.0, assert_one_dir)

    def test_logout_1(self):
        res = self.testapp.get('/_logout')
        assert res.headers['Location'] == 'http://localhost:80/'
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_logged_out_error(self):
        res = self.testapp.get('/test/test-migrate/mp_/http://httpbin.org/get?food=bar', status=404)

        res = self.testapp.get('/api/v1/curr_user')
        assert res.json['curr_user'] != self.anon_user and res.json['curr_user'].startswith('temp-')




