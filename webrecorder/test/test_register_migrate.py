from .testutils import FullStackTests

from mock import patch
from itertools import count

from pywb.recorder.multifilewarcwriter import MultiFileWARCWriter

from webrecorder.models.usermanager import CLIUserManager

import re
import os
import time


all_closed = False


# ============================================================================
class TestRegisterMigrate(FullStackTests):
    @classmethod
    def setup_class(cls):
        super(TestRegisterMigrate, cls).setup_class(extra_config_file='test_no_invites_config.yaml', storage_worker=True)
        cls.val_reg = ''

    def _move_rec(self, url):
        global all_closed
        all_closed = False

        def close_file(actual_self, filename):
            MultiFileWARCWriter.close_file(actual_self, filename)
            assert list(actual_self.iter_open_files()) == []
            global all_closed
            all_closed = True

        with patch('webrecorder.rec.webrecrecorder.SkipCheckingMultiFileWARCWriter.close_file', close_file):
            res = self.testapp.post_json(url)

            def assert_move():
                assert all_closed == True

            #self.sleep_try(0.1, 5.0, assert_move)

        return res

    def test_anon_record_1(self):
        res = self.testapp.get('/_new/temp/abc/record/mp_/http://httpbin.org/get?food=bar')
        res.headers['Location'].endswith('/' + self.anon_user + '/temp/abc/record/mp_/http://httpbin.org/get?food=bar')
        res = res.follow()
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'ts': '2016010203000000'}
        res = self.testapp.post_json('/api/v1/recordings/abc/pages?user={user}&coll=temp'.format(user=self.anon_user), params=page)

        assert res.json == {}

        user = self.anon_user
        coll, rec = self.get_coll_rec(user, 'temp', 'abc')

        warc_key = 'r:{rec}:warc'.format(rec=rec)
        assert self.redis.hlen(warc_key) == 1

        anon_dir = os.path.join(self.warcs_dir, user)
        assert len(os.listdir(anon_dir)) == 1

    def test_register(self):
        res = self.testapp.get('/_register')
        res.charset = 'utf-8'

        assert self.testapp.cookies['__test_sesh'] != ''

        assert '"toColl"' in res.text

    @classmethod
    def mock_send_reg_email(cls, sender, title, text):
        cls.val_reg = re.search('/_valreg/([^"]+)', text).group(1)

    def test_register_post_success(self):
        params = {'email': 'test@example.com',
                  'username': 'someuser',
                  'password': 'Password1',
                  'confirmpassword': 'Password1',

                  'toColl': 'Test Migrate',
                  'moveTemp': '1',
                 }

        with patch('cork.Mailer.send_email', self.mock_send_reg_email):
            #res = self.testapp.post('/_register', params=params)
            res = self.testapp.post_json('/api/v1/userreg', params=params)

        #assert res.headers['Location'] == 'http://localhost:80/'
        assert res.json == {
          'success': 'A confirmation e-mail has been sent to <b>someuser</b>. Please '
                     'check your e-mail to complete the registration!'}


    def test_val_user_reg_page(self):
        res = self.testapp.get('/_valreg/' + self.val_reg)
        assert self.val_reg in res.body.decode('utf-8')

    def test_val_user_reg_post(self):
        params = {'reg': self.val_reg}
        headers = {'Cookie': 'valreg=' + self.val_reg}
        res = self.testapp.post('/_valreg', params=params, headers=headers)

        assert res.headers['Location'] == 'http://localhost:80/'

        user_info = self.redis.hgetall('u:someuser:info')
        #user_info = self.appcont.manager._format_info(user_info)
        assert user_info['max_size'] == '1000000000'
        assert user_info['created_at'] != None

        coll, rec = self.get_coll_rec('someuser', 'test-migrate', None)
        key_prefix = 'c:{coll}'.format(coll=coll)

        assert self.redis.exists(key_prefix + ':info')
        coll_info = self.redis.hgetall(key_prefix + ':info')
        #coll_info = self.appcont.manager._format_info(coll_info)

        assert coll_info['owner'] == 'someuser'
        assert coll_info['title'] == 'Test Migrate'
        assert coll_info['created_at'] != None

        assert user_info['size'] == coll_info['size']

    def test_renamed_temp_to_perm(self):
        def assert_one_dir():
            coll_dir = os.path.join(self.storage_today, coll)
            assert set(os.listdir(coll_dir)) == {'warcs', 'indexes'}
            assert len(os.listdir(os.path.join(coll_dir, 'warcs'))) == 1
            assert len(os.listdir(os.path.join(coll_dir, 'indexes'))) == 1

        coll, rec = self.get_coll_rec('someuser', 'test-migrate', 'abc')
        assert coll != None

        self.sleep_try(0.2, 20.0, assert_one_dir)

        result = self.redis.hgetall('r:{rec}:warc'.format(rec=rec))
        storage_dir = self.storage_today.replace(os.path.sep, '/')
        for key in result:
            assert storage_dir in result[key]

    def test_logged_in_user_info(self):
        res = self.testapp.get('/someuser')
        assert '"/someuser/test-migrate"' in res.text
        assert 'Test Migrate' in res.text

    # no rec replay after commit
    def _test_logged_in_rec_replay_1(self):
        res = self.testapp.get('/someuser/test-migrate/abc/replay/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        # no cache control setting here (only at collection replay)
        assert 'Cache-Control' not in res.headers
        assert '"food": "bar"' in res.text, res.text

    def test_logged_in_replay_1(self):
        res = self.testapp.get('/someuser/test-migrate/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        # Cache-Control private to ignore cache
        assert res.headers['Cache-Control'] == 'private'
        assert '"food": "bar"' in res.text, res.text

    def test_logged_in_coll_info(self):
        res = self.testapp.get('/someuser/test-migrate')
        res.charset = 'utf-8'

        assert 'Test Migrate' in res.text

        assert '/someuser/test-migrate/' in res.text, res.text
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
        assert 'New Coll' in res.text

        # ensure csrf token present
        m = re.search('name="csrf" value="([^\"]+)"', res.text)
        assert m

    def test_logged_in_create_coll_dupe_name_error(self):
        params = {'title': 'New Coll',
                  'public': 'on'
                 }

        res = self.testapp.post('/_create', params=params, status=400)

    def test_logged_in_create_coll_new_name(self):
        params = {'title': 'New Coll 2',
                  'public': 'on'
                 }

        res = self.testapp.post('/_create', params=params)

        res.headers['Location'] == 'http://localhost:80/'

        res = self.testapp.get('/someuser/new-coll-2')

        assert 'Created collection' in res.text
        assert 'New Coll' in res.text

        # ensure csrf token present
        m = re.search('name="csrf" value="([^\"]+)"', res.text)
        assert m

    def test_logged_in_create_coll_and_rename_to_dupe_name(self):
        params = {'title': 'Other Coll',
                  'public': 'off'
                 }

        res = self.testapp.post('/_create', params=params)

        res.headers['Location'] == 'http://localhost:80/'

        res = self.testapp.get('/someuser/other-coll')

        assert 'Other Coll' in res.text

        params = {'title': 'New Coll'}

        res = self.testapp.post_json('/api/v1/collection/other-coll?user=someuser', params=params)

        assert res.json == {'error_message': 'duplicate name: new-coll'}

        params = {'title': 'New Coll 3'}

        res = self.testapp.post_json('/api/v1/collection/other-coll?user=someuser', params=params)

        assert res.json['collection']['id'] == 'new-coll-3'

        assert set(self.redis.hkeys('u:someuser:colls')) == {'new-coll-3', 'new-coll', 'test-migrate', 'new-coll-2'}

    def test_logged_in_user_info_2(self):
        res = self.testapp.get('/someuser')
        assert '"/someuser/test-migrate"' in res.text
        assert 'Test Migrate' in res.text

        assert '"/someuser/new-coll"' in res.text
        assert 'New Coll' in res.text

    def test_logged_in_record_1(self):
        res = self.testapp.get('/_new/new-coll/move-test/record/mp_/http://example.com/')
        assert res.status_code == 302
        assert res.headers['Location'].endswith('/someuser/new-coll/move-test/record/mp_/http://example.com/')
        res = res.follow()

        res.charset = 'utf-8'
        assert 'Example Domain' in res.text

        # allow recording to be written
        def assert_written():
            coll, rec = self.get_coll_rec('someuser', 'new-coll', 'move-test')
            assert coll
            assert rec
            assert self.redis.exists('r:{0}:cdxj'.format(rec))
            assert self.redis.exists('r:{0}:warc'.format(rec))

        self.sleep_try(0.1, 5.0, assert_written)

    def test_logged_in_replay_public(self):
        res = self.testapp.get('/someuser/new-coll/mp_/http://example.com/')
        res.charset = 'utf-8'

        # no cache-control for public collections
        assert 'Cache-Control' not in res.headers
        assert 'Example Domain' in res.text

    def test_logged_in_download(self):
        res = self.testapp.head('/someuser/new-coll/$download')

        assert res.headers['Content-Disposition'].startswith("attachment; filename*=UTF-8''new-coll-")

    def get_rec_names(self, user, coll_name):
        coll, rec = self.get_coll_rec(user, coll_name, None)

        return set(self.redis.hkeys('c:{coll}:recs'.format(coll=coll)))

    def test_logged_in_move_rec(self):
        assert self.get_rec_names('someuser', 'new-coll') == {'move-test'}
        assert self.get_rec_names('someuser', 'new-coll-2') == set()

        res = self._move_rec('/api/v1/recordings/move-test/move/new-coll-2?user=someuser&coll=new-coll')

        assert res.json == {'coll_id': 'new-coll-2', 'rec_id': 'move-test'}

        assert self.get_rec_names('someuser', 'new-coll') == set()
        assert self.get_rec_names('someuser', 'new-coll-2') == {'move-test'}

        # rec replay
        res = self.testapp.get('/someuser/new-coll-2/move-test/replay/mp_/http://example.com/')
        res.charset = 'utf-8'

        assert 'Example Domain' in res.text

        # coll replay
        res = self.testapp.get('/someuser/new-coll-2/mp_/http://example.com/')
        res.charset = 'utf-8'

        assert 'Example Domain' in res.text

    def test_logged_in_record_2(self):
        res = self.testapp.get('/_new/new-coll/Move Test/record/mp_/http://httpbin.org/get?rec=test')
        assert res.status_code == 302
        assert res.headers['Location'].endswith('/someuser/new-coll/move-test/record/mp_/http://httpbin.org/get?rec=test')
        res = res.follow()

        res.charset = 'utf-8'
        assert '"rec": "test"' in res.text

        coll, rec = self.get_coll_rec('someuser', 'new-coll', 'move-test')

        assert self.redis.exists('r:{0}:open'.format(rec))

        # allow recording to be written
        def assert_written():
            assert coll
            assert rec
            assert self.redis.exists('r:{0}:cdxj'.format(rec))
            assert self.redis.exists('r:{0}:warc'.format(rec))

        self.sleep_try(0.1, 5.0, assert_written)

    def test_logged_in_replay_2(self):
        res = self.testapp.get('/someuser/new-coll/move-test/replay/mp_/http://httpbin.org/get?rec=test')
        res.charset = 'utf-8'
        assert '"rec": "test"' in res.text

    def test_logged_in_move_rec_dupe(self):
        assert self.get_rec_names('someuser', 'new-coll') == {'move-test'}
        assert self.get_rec_names('someuser', 'new-coll-2') == {'move-test'}

        res = self._move_rec('/api/v1/recordings/move-test/move/new-coll-2?user=someuser&coll=new-coll')

        assert res.json == {'coll_id': 'new-coll-2', 'rec_id': 'move-test-2'}

        assert self.get_rec_names('someuser', 'new-coll') == set()
        assert self.get_rec_names('someuser', 'new-coll-2') == {'move-test', 'move-test-2'}

        # rec replay
        res = self.testapp.get('/someuser/new-coll-2/move-test-2/replay/mp_/http://httpbin.org/get?rec=test')
        res.charset = 'utf-8'

        assert '"rec": "test"' in res.text

        #coll, rec = self.get_coll_rec('someuser', 'new-coll')
        #assert self.redis.exists('c:{coll}:cdxj'.format(coll=coll))

        # coll replay
        res = self.testapp.get('/someuser/new-coll-2/mp_/http://httpbin.org/get?rec=test')
        res.charset = 'utf-8'

        assert '"rec": "test"' in res.text

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
        res = self.testapp.get('/someuser/new-coll-2/mp_/http://example.com/')
        res.charset = 'utf-8'

        # no cache-control for public collections
        assert 'Cache-Control' not in res.headers
        assert 'Example Domain' in res.text

    def test_error_logged_out_download(self):
        res = self.testapp.get('/someuser/new-coll/$download', status=404)
        assert res.json == {'error': 'not_found'}

    def test_error_logged_out_no_coll(self):
        res = self.testapp.get('/someuser/test-migrate', status=404)
        assert res.json == {'error': 'not_found'}

    def test_error_logged_out_record(self):
        res = self.testapp.get('/someuser/new-coll/move-test/record/mp_/http://example.com/', status=404)
        assert res.json == {'error': 'not_found'}

    def test_error_logged_out_patch(self):
        res = self.testapp.get('/someuser/new-coll/move-test/patch/mp_/http://example.com/', status=404)
        assert res.json == {'error': 'not_found'}

    def test_error_logged_out_replay_coll_1(self):
        res = self.testapp.get('/someuser/test-migrate/mp_/http://httpbin.org/get?food=bar', status=404)
        assert res.json == {'error': 'not_found'}

    def test_login(self):
        params = {'username': 'someuser',
                  'password': 'Password1'}

        res = self.testapp.post_json('/api/v1/login', params=params)
        assert res.json == {'anon': False,
                            'coll_count': 4,
                            'role': 'archivist',
                            'username': 'someuser'}

        assert self.testapp.cookies.get('__test_sesh', '') != ''

    def _test_rename_rec(self):
        res = self.testapp.post_json('/api/v1/recordings/abc/rename/FOOD%20BAR?user=someuser&coll=test-migrate')

        assert res.json == {'rec_id': 'food-bar', 'coll_id': 'test-migrate'}

        assert self.get_rec_names('someuser', 'test-migrate') == {'food-bar'}

        # rec replay
        res = self.testapp.get('/someuser/test-migrate/food-bar/replay/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        # coll replay
        res = self.testapp.get('/someuser/test-migrate/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_rename_coll(self):
        params = {'title': 'Test Coll'}
        res = self.testapp.post_json('/api/v1/collection/test-migrate?user=someuser', params=params)

        assert res.json['collection']['id'] == 'test-coll'
        assert res.json['collection']['title'] == 'Test Coll'

        assert set(self.redis.hkeys('u:someuser:colls')) == {'new-coll-3', 'new-coll', 'test-coll', 'new-coll-2'}

        # rec replay
        #res = self.testapp.get('/someuser/test-coll/abc/replay/mp_/http://httpbin.org/get?food=bar')
        #res.charset = 'utf-8'

        #assert '"food": "bar"' in res.text, res.text

        # coll replay
        res = self.testapp.get('/someuser/test-coll/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_delete_coll_invalid_csrf(self):
        # no csrf token, should result in 403
        res = self.testapp.post('/_delete_coll?user=someuser&coll=test-coll', status=403)

        # invalid csrf token, should result in 403
        params = {'csrf': 'xyz'}
        res = self.testapp.post('/_delete_coll?user=someuser&coll=test-coll', params=params, status=403)

    def test_delete_coll(self):
        res = self.testapp.get('/someuser/new-coll')

        csrf_token = re.search('name="csrf" value="([^\"]+)"', res.text).group(1)

        user_dir = os.path.join(self.warcs_dir, 'someuser')

        coll, rec = self.get_coll_rec('someuser', 'test-coll', '')

        st_warcs_dir = os.path.join(self.storage_today, coll, 'warcs')
        st_index_dir = os.path.join(self.storage_today, coll, 'indexes')

        assert len(os.listdir(user_dir)) >= 2

        assert len(os.listdir(st_warcs_dir)) == 1
        assert len(os.listdir(st_index_dir)) == 1

        params = {'csrf': csrf_token}
        res = self.testapp.post('/_delete_coll?user=someuser&coll=test-coll', params=params)

        assert set(self.redis.hkeys('u:someuser:colls')) == {'new-coll-3', 'new-coll', 'new-coll-2'}

        assert res.headers['Location'] == 'http://localhost:80/someuser'

        def assert_delete_warcs():
            assert len(os.listdir(user_dir)) == 2
            assert not os.path.isdir(st_warcs_dir)
            assert not os.path.isdir(st_index_dir)
            #assert len(os.listdir(st_warcs_dir)) == 0
            #assert len(os.listdir(st_index_dir)) == 0

        self.sleep_try(0.1, 10.0, assert_delete_warcs)

    def test_create_another_user(self):
        m = CLIUserManager()
        m.create_user( email='test2@example.com',
                       username='testauto',
                       passwd='Test12345',
                       role='archivist',
                       name='Test User')

        assert self.redis.exists('u:testauto:info')

    def test_already_logged_in(self):
        params = {'username': 'testauto',
                  'password': 'Test12345'}

        res = self.testapp.post('/_login', params=params)

        assert res.headers['Location'] == 'http://localhost:80/'
        assert self.testapp.cookies.get('__test_sesh', '') != ''

        res = res.follow()
        assert 'You are already logged' in res.text

    def test_logout_2(self):
        res = self.testapp.get('/_logout')
        assert res.headers['Location'] == 'http://localhost:80/'
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_login_another(self):
        params = {'username': 'testauto',
                  'password': 'Test12345'}

        res = self.testapp.post_json('/api/v1/login', params=params)

        assert res.json == {'anon': False,
                            'coll_count': 1,
                            'role': 'archivist',
                            'username': 'testauto'}

        assert self.testapp.cookies.get('__test_sesh', '') != ''

    def test_different_user_default_coll(self):
        res = self.testapp.get('/testauto/default-collection')
        assert '/default-collection' in res.text, res.text

    def test_different_user_coll(self):
        res = self.testapp.get('/someuser/new-coll-2')
        assert '/new-coll' in res.text, res.text

    def test_different_user_replay(self):
        res = self.testapp.get('/someuser/new-coll-2/mp_/http://example.com/')
        res.charset = 'utf-8'

        # no cache-control for public collections
        assert 'Cache-Control' not in res.headers
        assert 'Example Domain' in res.text

    def test_different_user_replay_2(self):
        res = self.testapp.get('/someuser/new-coll-2/mp_/http://httpbin.org/get?rec=test')
        res.charset = 'utf-8'

        assert '"rec": "test"' in res.text

    def test_different_user_replay_private_error(self):
        res = self.testapp.get('/someuser/test-migrate/mp_/http://httpbin.org/get?food=bar', status=404)
        assert res.json == {'error': 'not_found'}

    def test_logout_3(self):
        res = self.testapp.get('/_logout')
        assert res.headers['Location'] == 'http://localhost:80/'
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_login_3(self):
        params = {'username': 'someuser',
                  'password': 'Password1'}

        res = self.testapp.post_json('/api/v1/login', params=params)

        assert res.json == {'anon': False,
                            'coll_count': 3,
                            'role': 'archivist',
                            'username': 'someuser'}

        assert self.testapp.cookies.get('__test_sesh', '') != ''

    def test_delete_user_wrong_user(self):
        res = self.testapp.get('/_settings')

        csrf_token = re.search('name="csrf" value="([^\"]+)"', res.text).group(1)

        # wrong user!
        params = {'csrf': csrf_token}
        res = self.testapp.post('/testauto/$delete', params=params)
        assert res.headers['Location'] == 'http://localhost:80/testauto'

    def test_delete_user_wrong_csrf(self):
        # right user, invalid csrf
        params = {'csrf': 'xyz'}
        res = self.testapp.post('/someuser/$delete', params=params, status=403)
        assert res.status_code == 403


    def test_delete_user(self):
        res = self.testapp.get('/_settings')

        csrf_token = re.search('name="csrf" value="([^\"]+)"', res.text).group(1)

        user_dir = os.path.join(self.warcs_dir, 'someuser')

        st_warcs_dir = os.path.join(self.storage_today, 'warcs')
        st_index_dir = os.path.join(self.storage_today, 'indexes')

        params = {'csrf': csrf_token}
        res = self.testapp.post('/someuser/$delete', params=params)

        assert res.headers['Location'] == 'http://localhost:80/'
        assert self.testapp.cookies.get('__test_sesh', '') == ''

        assert not self.redis.exists('u:someuser:info')
        assert set(self.redis.hkeys('u:someuser:colls')) == set()
        assert self.redis.sismember('s:users', 'someuser') == False

        def assert_delete():
            assert len(os.listdir(user_dir)) == 0
            assert not os.path.isdir(st_warcs_dir)
            assert not os.path.isdir(st_index_dir)

        self.sleep_try(0.3, 10.0, assert_delete)

    def test_login_4_no_such_user(self):
        params = {'username': 'someuser',
                  'password': 'Password1'}

        res = self.testapp.post_json('/api/v1/login', params=params, status=401)
        assert res.json == {"error": "Invalid Login. Please Try Again"}

        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_user_settings_error(self):
        res = self.testapp.get('/_settings', status=404)


