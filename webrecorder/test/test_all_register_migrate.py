from .testutils import FullStackTests

from mock import patch

import re
import os
import time


# ============================================================================
class TestRegisterMigrate(FullStackTests):
    @classmethod
    def setup_class(cls):
        super(TestRegisterMigrate, cls).setup_class(extra_config_file='test_no_invites_config.yaml')
        cls.val_reg = ''

    def test_anon_record_1(self):
        res = self.testapp.get('/' + self.anon_user + '/temp/abc/record/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'ts': '2016010203000000'}
        res = self.testapp.post('/api/v1/recordings/abc/pages?user={user}&coll=temp'.format(user=self.anon_user), params=page)

        assert res.json == {}

        user = self.anon_user

        warc_key = 'r:{user}:{coll}:{rec}:warc'.format(user=user, coll='temp', rec='abc')
        assert self.redis.hlen(warc_key) == 1

        anon_dir = os.path.join(self.warcs_dir, user)
        assert len(os.listdir(anon_dir)) == 1

    def test_register(self):
        res = self.testapp.get('/_register')
        res.charset = 'utf-8'

        assert self.testapp.cookies['__test_sesh'] != ''

        assert '"to-coll"' in res.text

    @classmethod
    def mock_send_reg_email(cls, sender, title, text):
        cls.val_reg = re.search('/_valreg/([^"]+)', text).group(1)

    def test_register_post_success(self):
        params = {'email': 'test@example.com',
                  'username': 'someuser',
                  'password': 'Password1',
                  'confirmpassword': 'Password1',

                  'to-coll': 'Test Migrate',
                  'move-temp': '1',
                 }

        with patch('cork.Mailer.send_email', self.mock_send_reg_email):
            res = self.testapp.post('/_register', params=params)

        assert res.headers['Location'] == 'http://localhost:80/'

    def test_val_user_reg_page(self):
        res = self.testapp.get('/_valreg/' + self.val_reg)
        assert self.val_reg in res.body.decode('utf-8')

    def test_val_user_reg_post(self):
        params = {'reg': self.val_reg}
        headers = {'Cookie': 'valreg=' + self.val_reg}
        res = self.testapp.post('/_valreg', params=params, headers=headers)

        assert res.headers['Location'] == 'http://localhost:80/'

        user_info = self.redis.hgetall('u:someuser:info')
        user_info = self.appcont.manager._format_info(user_info)
        assert user_info['max_size'] == '1000000000'
        assert user_info['max_coll'] == '10'
        assert user_info['created_at'] != None

        assert self.redis.exists('c:someuser:test-migrate:info')
        coll_info = self.redis.hgetall('c:someuser:test-migrate:info')
        coll_info = self.appcont.manager._format_info(coll_info)

        assert coll_info['id'] == 'test-migrate'
        assert coll_info['title'] == 'Test Migrate'
        assert coll_info['created_at'] != None

        assert user_info['size'] == coll_info['size']

        allwarcs = self.redis.hgetall('c:someuser:test-migrate:warc')
        for n, v in allwarcs.items():
            assert v.decode('utf-8').endswith('/someuser/test-migrate/abc/' + n.decode('utf-8'))

    def test_renamed_temp_to_perm(self):
        time.sleep(2.0)

        user_dir = os.path.join(self.warcs_dir, 'someuser')
        assert len(os.listdir(user_dir)) == 1

    def test_logged_in_user_info(self):
        res = self.testapp.get('/someuser')
        assert '"/someuser/test-migrate"' in res.text
        assert 'Test Migrate' in res.text

    def test_logged_in_replay_1(self):
        res = self.testapp.get('/someuser/test-migrate/abc/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_logged_in_replay_coll_1(self):
        res = self.testapp.get('/someuser/test-migrate/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_logged_in_coll_info(self):
        res = self.testapp.get('/someuser/test-migrate')
        res.charset = 'utf-8'

        assert 'Test Migrate' in res.text

        assert '/someuser/test-migrate/' in res.text
        assert '/http://httpbin.org/get?food=bar' in res.text

    def test_logged_in_rec_info(self):
        res = self.testapp.get('/someuser/test-migrate/abc')
        res.charset = 'utf-8'

        assert 'Test Migrate' in res.text

        assert '/someuser/test-migrate/' in res.text
        assert '/http://httpbin.org/get?food=bar' in res.text

    def test_logged_in_create_coll_page(self):
        res = self.testapp.get('/_create')
        #assert 'https://webrecorder.io/someuser/' in res.text
        assert 'New Collection' in res.text

    def test_logged_in_create_coll(self):
        params = {'title': 'New Coll',
                  'public': 'on'
                 }

        res = self.testapp.post('/_create', params=params)

        res.headers['Location'] == 'http://localhost:80/'

        res = self.testapp.get('/someuser/new-coll')

        assert 'Created collection' in res.text

    def test_logged_in_user_info_2(self):
        res = self.testapp.get('/someuser')
        assert '"/someuser/test-migrate"' in res.text
        assert 'Test Migrate' in res.text

        assert '"/someuser/new-coll"' in res.text
        assert 'New Coll' in res.text

    def test_logged_in_patch(self):
        res = self.testapp.get('/someuser/new-coll/foo/patch/mp_/http://example.com/')
        res.charset = 'utf-8'
        assert 'Example Domain' in res.text

    def test_logged_in_replay_2(self):
        res = self.testapp.get('/someuser/new-coll/foo/mp_/http://example.com/')
        res.charset = 'utf-8'
        assert 'Example Domain' in res.text

    def test_logout_1(self):
        res = self.testapp.get('/_logout')
        assert res.headers['Location'] == 'http://localhost:80/'
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_logged_out_user_info(self):
        res = self.testapp.get('/someuser')

        assert '"/someuser/new-coll"' in res.text
        assert 'New Coll' in res.text

    def test_logged_out_coll(self):
        res = self.testapp.get('/someuser/new-coll')
        assert '/new-coll' in res.text, res.text

    def test_logged_out_replay(self):
        res = self.testapp.get('/someuser/new-coll/foo/mp_/http://example.com/')
        res.charset = 'utf-8'
        assert 'Example Domain' in res.text

    def test_error_logged_out_no_coll(self):
        res = self.testapp.get('/someuser/test-migrate', status=404)
        assert 'No such page' in res.text

    def test_error_logged_out_record(self):
        res = self.testapp.get('/someuser/new-coll/foo/record/mp_/http://example.com/', status=404)
        assert 'No such page' in res.text

    def test_error_logged_out_patch(self):
        res = self.testapp.get('/someuser/new-coll/foo/patch/mp_/http://example.com/', status=404)
        assert 'No such page' in res.text

    def test_error_logged_in_replay_coll_1(self):
        res = self.testapp.get('/someuser/test-migrate/mp_/http://httpbin.org/get?food=bar', status=404)
        assert 'No such page' in res.text

    def test_login_2(self):
        params = {'username': 'someuser',
                  'password': 'Password1'}

        res = self.testapp.post('/_login', params=params)

        assert res.headers['Location'] == 'http://localhost:80/someuser'
        assert self.testapp.cookies.get('__test_sesh', '') != ''

    def test_rename_rec(self):
        res = self.testapp.post('/api/v1/recordings/abc/rename/FOOD%20BAR?user=someuser&coll=test-migrate')

        assert res.json == {'title': 'FOOD BAR', 'rec_id': 'food-bar', 'coll_id': 'test-migrate'}

        #time.sleep(2.0)

        res = self.testapp.get('/someuser/test-migrate/food-bar/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_rename_coll(self):
        res = self.testapp.post('/api/v1/collections/test-migrate/rename/Test Coll?user=someuser')

        assert res.json == {'title': 'Test Coll', 'coll_id': 'test-coll', 'rec_id': '*'}
        #time.sleep(2.0)

        res = self.testapp.get('/someuser/test-coll/food-bar/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_delete_coll(self):
        res = self.testapp.post('/_delete_coll?user=someuser&coll=test-coll')

        assert res.headers['Location'] == 'http://localhost:80/someuser'


