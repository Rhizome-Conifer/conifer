from .testutils import FullStackTests, Recording, Collection, BaseAccess

from mock import patch
from itertools import count

from pywb.recorder.multifilewarcwriter import MultiFileWARCWriter

from webrecorder.models.usermanager import CLIUserManager
from webrecorder.rec.storage import get_storage

from webrecorder.models.stats import Stats
from webrecorder.utils import today_str

from six.moves.urllib.parse import urlsplit

import re
import os
import time


all_closed = False


# ============================================================================
class TestRegisterMigrate(FullStackTests):
    @classmethod
    def setup_class(cls):
        super(TestRegisterMigrate, cls).setup_class(extra_config_file='test_no_invites_config.yaml',
                                                    storage_worker=True,
                                                    temp_worker=True)
        cls.val_reg = ''

    def test_anon_record_1(self):
        self.set_uuids('Recording', ['abc'])
        res = self.testapp.get('/_new/temp/abc/record/mp_/http://httpbin.org/get?food=bar')
        res.headers['Location'].endswith('/' + self.anon_user + '/temp/abc/record/mp_/http://httpbin.org/get?food=bar')
        res = res.follow()
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'ts': '2016010203000000'}
        res = self.testapp.post_json('/api/v1/recording/abc/pages?user={user}&coll=temp'.format(user=self.anon_user), params=page)

        assert res.json['page_id']

        user = self.anon_user
        coll, rec = self.get_coll_rec(user, 'temp', 'abc')

        self.assert_coll_rec_warcs(coll, rec, 1, 1)

        anon_dir = os.path.join(self.warcs_dir, user)
        assert len(os.listdir(anon_dir)) == 1

    def _test_register(self):
        res = self.testapp.get('/_register')
        res.charset = 'utf-8'

        assert self.testapp.cookies['__test_sesh'] != ''

        assert '"toColl"' in res.text

    @classmethod
    def mock_send_reg_email(cls, sender, title, text):
        cls.val_reg = re.search('/_valreg/([^"?]+)', text).group(1)
        assert '?username=' in text

    def test_register_post_success(self):
        params = {'email': 'test@example.com',
                  'username': 'someuser',
                  'password': 'Password1',
                  'confirmpassword': 'Password1',

                  'toColl': 'Test Migrate',
                  'moveTemp': '1',
                 }

        with patch('cork.Mailer.send_email', self.mock_send_reg_email):
            res = self.testapp.post_json('/api/v1/auth/register', params=params)

        #assert res.headers['Location'] == 'http://localhost:80/'
        assert res.json == {
          'success': 'A confirmation e-mail has been sent to <b>someuser</b>. Please '
                     'check your e-mail to complete the registration!'}


    def _test_val_user_reg_page(self):
        res = self.testapp.get('/_valreg/' + self.val_reg)
        assert self.val_reg in res.body.decode('utf-8')

    def test_val_user_reg_post(self):
        params = {'reg': self.val_reg}
        headers = {'Cookie': '__test_sesh={0}; valreg={1}'.format(self.testapp.cookies['__test_sesh'], self.val_reg)}

        def _get_storage(storage_type, redis):
            time.sleep(1.1)
            return get_storage(storage_type, redis)

        with patch('webrecorder.models.collection.get_global_storage', _get_storage) as p:
            res = self.testapp.post_json('/api/v1/auth/validate', params=params, headers=headers)
            time.sleep(1.1)

        assert res.json == {'first_coll_name': 'test-migrate', 'registered': 'someuser'}

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

        #result = self.redis.hgetall('r:{rec}:warc'.format(rec=rec))
        result = self.redis.hgetall(Recording.COLL_WARC_KEY.format(coll=coll))
        assert len(result) == 1
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

    def _test_logged_in_create_coll_page(self):
        res = self.testapp.get('/_create')
        #assert 'https://webrecorder.io/someuser/' in res.text
        assert 'New Collection' in res.text

    def test_logged_in_create_coll(self):
        params = {'title': 'New Coll',
                  'public': True,
                 }

        res = self.testapp.post_json('/api/v1/collections?user=someuser', params=params)

        #res.headers['Location'] == 'http://localhost:80/'
        assert res.json['collection']['slug'] == 'new-coll'

        res = self.testapp.get('/someuser/new-coll')

        assert 'Created collection' in res.text
        assert 'New Coll' in res.text

        # ensure csrf token present
        #m = re.search('name="csrf" value="([^\"]+)"', res.text)
        #assert m

    def test_logged_in_create_coll_dupe_name_error(self):
        params = {'title': 'New Coll',
                  'public': True,
                 }

        res = self.testapp.post_json('/api/v1/collections?user=someuser', params=params, status=400)

        assert res.json['error'] == 'duplicate_name'

    def test_logged_in_create_coll_new_name(self):
        params = {'title': 'New Coll 2',
                  'public': True
                 }

        res = self.testapp.post_json('/api/v1/collections?user=someuser', params=params)

        assert res.json['collection']['slug'] == 'new-coll-2'

        res = self.testapp.get('/someuser/new-coll-2')

        assert 'Created collection' in res.text
        assert 'New Coll' in res.text

        # ensure csrf token present
        #m = re.search('name="csrf" value="([^\"]+)"', res.text)
        #assert m

    def test_logged_in_create_coll_and_rename_to_dupe_name(self):
        params = {'title': 'Other Coll',
                  'public': False
                 }

        res = self.testapp.post_json('/api/v1/collections?user=someuser', params=params)

        assert res.json['collection']['slug'] == 'other-coll'

        res = self.testapp.get('/someuser/other-coll')

        assert 'Other Coll' in res.text

        params = {'title': 'New Coll'}

        res = self.testapp.post_json('/api/v1/collection/other-coll?user=someuser', params=params, status=400)

        assert res.json == {'error': 'duplicate_name'}

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
        self.set_uuids('Recording', ['move-test'])
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
            assert self.redis.exists(Recording.CDXJ_KEY.format(rec=rec))
            assert self.redis.exists(Recording.REC_WARC_KEY.format(rec=rec))
            assert self.redis.exists(Recording.COLL_WARC_KEY.format(coll=coll))

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

    def test_wasapi_list(self):
        res = self.testapp.get('/api/v1/download/webdata')
        assert len(res.json['files']) == 2
        assert res.json['files'][0]['checksums']
        assert res.json['files'][0]['locations']

        assert res.json['files'][1]['checksums']
        assert res.json['files'][1]['locations']

        assert sum((1 if val['is_active'] else 0 for val in res.json['files']), 0) == 1

        wasapi_filename = res.json['files'][0]['locations'][0]
        res = self.testapp.head(urlsplit(wasapi_filename).path)

        assert res.headers['Content-Disposition'].startswith("attachment; filename*=UTF-8''rec-")

    def get_rec_titles(self, user, coll_name, num):
        coll, rec = self.get_coll_rec(user, coll_name, None)

        assert self.redis.hlen(Recording.COLL_WARC_KEY.format(coll=coll)) == num

        collection = Collection(my_id=coll, redis=self.redis, access=BaseAccess())

        return set([recording['title'] for recording in collection.get_recordings()])

        #return self.redis.smembers(Collection.UNORDERED_RECS_KEY.format(coll=coll))
        #return set(self.redis.hkeys(Collection.COMP_KEY.format(coll=coll)))

    def test_logged_in_move_rec(self):
        assert self.get_rec_titles('someuser', 'new-coll', 1) == {'move-test'}
        assert self.get_rec_titles('someuser', 'new-coll-2', 0) == set()

        res = self.testapp.post_json('/api/v1/recording/move-test/move/new-coll-2?user=someuser&coll=new-coll')

        #assert res.json == {'coll_id': 'new-coll-2', 'rec_id': 'move-test'}
        assert res.json['coll_id'] == 'new-coll-2'
        rec_id = res.json['rec_id']

        def assert_moved():
            assert self.get_rec_titles('someuser', 'new-coll', 0) == set()
            assert self.get_rec_titles('someuser', 'new-coll-2', 1) == {'move-test'}

        self.sleep_try(0.2, 5.0, assert_moved)

        # rec replay
        res = self.testapp.get('/someuser/new-coll-2/{0}/replay/mp_/http://example.com/'.format(rec_id))
        res.charset = 'utf-8'

        assert 'Example Domain' in res.text

        # coll replay
        res = self.testapp.get('/someuser/new-coll-2/mp_/http://example.com/')
        res.charset = 'utf-8'

        assert 'Example Domain' in res.text

    def test_logged_in_record_2(self):
        self.set_uuids('Recording', ['move-test'])
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
            assert self.redis.exists(Recording.CDXJ_KEY.format(rec=rec))
            assert self.redis.exists(Recording.REC_WARC_KEY.format(rec=rec))
            assert self.redis.exists(Recording.COLL_WARC_KEY.format(coll=coll))

        self.sleep_try(0.1, 5.0, assert_written)

    def test_logged_in_replay_2(self):
        res = self.testapp.get('/someuser/new-coll/move-test/replay/mp_/http://httpbin.org/get?rec=test')
        res.charset = 'utf-8'
        assert '"rec": "test"' in res.text

    def test_logged_in_move_rec_dupe(self):
        assert self.get_rec_titles('someuser', 'new-coll', 1) == {'Move Test'}
        assert self.get_rec_titles('someuser', 'new-coll-2', 1) == {'move-test'}

        res = self.testapp.post_json('/api/v1/recording/move-test/move/new-coll-2?user=someuser&coll=new-coll')

        #assert res.json == {'coll_id': 'new-coll-2', 'rec_id': 'move-test-2'}
        assert res.json['coll_id'] == 'new-coll-2'
        rec_id = res.json['rec_id']


        def assert_moved():
            assert self.get_rec_titles('someuser', 'new-coll', 0) == set()
            assert self.get_rec_titles('someuser', 'new-coll-2', 2) == {'move-test', 'Move Test'}

        self.sleep_try(0.2, 5.0, assert_moved)

        # rec replay
        res = self.testapp.get('/someuser/new-coll-2/{0}/replay/mp_/http://httpbin.org/get?rec=test'.format(rec_id))
        res.charset = 'utf-8'

        assert '"rec": "test"' in res.text

        # coll replay
        res = self.testapp.get('/someuser/new-coll-2/mp_/http://httpbin.org/get?rec=test')
        res.charset = 'utf-8'

        assert '"rec": "test"' in res.text

    def test_logout_1(self):
        res = self.testapp.post_json('/api/v1/auth/logout', status=200)
        assert res.json['success']
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

    def test_error_logged_out_wasapi_list(self):
        res = self.testapp.get('/api/v1/download/webdata?user=someuser', status=404)
        assert res.json == {'error': 'not_found'}

    def test_error_logged_out_no_coll(self):
        res = self.testapp.get('/someuser/test-migrate', status=404)
        assert res.json == {'error': 'not_found'}

    def test_error_logged_out_record(self):
        res = self.testapp.get('/someuser/new-coll/move-test/record/mp_/http://example.com/', status=404)
        assert res.json == {'error': 'no_such_recording'}

    def test_error_logged_out_patch(self):
        res = self.testapp.get('/someuser/new-coll/move-test/patch/mp_/http://example.com/', status=404)
        assert res.json == {'error': 'no_such_recording'}

    def test_error_logged_out_replay_coll_1(self):
        res = self.testapp.get('/someuser/test-migrate/mp_/http://httpbin.org/get?food=bar', status=404)
        assert res.json == {'error': 'no_such_collection'}

    def test_logged_out_wasapi_list_basic_auth(self):
        self.testapp.authorization = ('Basic', ('someuser', 'Password1'))
        res = self.testapp.get('/api/v1/download/webdata')
        self.testapp.authorization = None

        assert len(res.json['files']) == 3
        assert res.json['files'][0]['checksums']
        assert res.json['files'][0]['locations']

        assert sum((1 if val['is_active'] else 0 for val in res.json['files']), 0) == 2

        wasapi_filename = res.json['files'][0]['locations'][0]

        # 404 without basic auth
        res = self.testapp.head(urlsplit(wasapi_filename).path, status=404)

        # 200 with basic auth
        self.testapp.authorization = ('Basic', ('someuser', 'Password1'))
        res = self.testapp.head(urlsplit(wasapi_filename).path)
        assert res.headers['Content-Disposition'].startswith("attachment; filename*=UTF-8''rec-")
        self.testapp.authorization = None

    def test_login(self):
        params = {'username': 'someuser',
                  'password': 'Password1'}

        res = self.testapp.post_json('/api/v1/auth/login', params=params)
        assert res.json['user']['anon'] == False
        assert res.json['user']['num_collections'] == 4
        assert res.json['user']['role'] == 'archivist'
        assert res.json['user']['username'] == 'someuser'

        assert 'max-age=' not in res.headers['Set-Cookie'].lower()

        assert self.testapp.cookies.get('__test_sesh', '') != ''

    def _test_rename_rec(self):
        res = self.testapp.post_json('/api/v1/recording/abc/rename/FOOD%20BAR?user=someuser&coll=test-migrate')

        assert res.json == {'rec_id': 'food-bar', 'coll_id': 'test-migrate'}

        assert self.get_rec_titles('someuser', 'test-migrate', 1) == {'food-bar'}

        # rec replay
        res = self.testapp.get('/someuser/test-migrate/food-bar/replay/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        # coll replay
        res = self.testapp.get('/someuser/test-migrate/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_rename_coll_invalid_name(self):
        # empty title
        params = {'title': ''}
        res = self.testapp.post_json('/api/v1/collection/test-migrate?user=someuser', params=params, status=400)

        assert res.json['error'] == 'invalid_coll_name'

        # title that results in empty slug
        params = {'title': '@$%'}
        res = self.testapp.post_json('/api/v1/collection/test-migrate?user=someuser', params=params, status=400)

        assert res.json['error'] == 'invalid_coll_name'

        assert set(self.redis.hkeys('u:someuser:colls')) == {'new-coll-3', 'new-coll', 'test-migrate', 'new-coll-2'}

    def test_rename_coll(self):
        params = {'title': 'Test Coll'}
        res = self.testapp.post_json('/api/v1/collection/test-migrate?user=someuser', params=params)

        assert res.json['collection']['id'] == 'test-coll'
        assert res.json['collection']['slug'] == 'test-coll'
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

    def test_rename_coll_title_only(self):
        params = {'title': '!@Test Coll@!'}
        res = self.testapp.post_json('/api/v1/collection/test-migrate?user=someuser', params=params)

        assert res.json['collection']['id'] == 'test-coll'
        assert res.json['collection']['slug'] == 'test-coll'
        assert res.json['collection']['title'] == '!@Test Coll@!'

        assert set(self.redis.hkeys('u:someuser:colls')) == {'new-coll-3', 'new-coll', 'test-coll', 'new-coll-2'}

    def test_orig_slug_after_rename(self):
        res = self.testapp.get('/api/v1/collection/test-migrate?user=someuser')

        assert res.json['collection']['id'] == 'test-coll'
        assert res.json['collection']['slug'] == 'test-coll'
        assert res.json['collection']['title'] == '!@Test Coll@!'
        #assert res.json['collection']['title'] == 'Test Coll'
        assert res.json['collection']['slug_matched'] == False

        res = self.testapp.get('/someuser/test-migrate/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def _test_delete_coll_invalid_csrf(self):
        # no csrf token, should result in 403
        res = self.testapp.post_json('/_delete_coll?user=someuser&coll=test-coll', status=403)

        # invalid csrf token, should result in 403
        params = {'csrf': 'xyz'}
        res = self.testapp.post_json('/_delete_coll?user=someuser&coll=test-coll', params=params, status=403)

    def test_delete_coll(self):
        res = self.testapp.get('/someuser/new-coll')

        #csrf_token = re.search('name="csrf" value="([^\"]+)"', res.text).group(1)

        user_dir = os.path.join(self.warcs_dir, 'someuser')

        coll, rec = self.get_coll_rec('someuser', 'test-coll', '')

        st_warcs_dir = os.path.join(self.storage_today, coll, 'warcs')
        st_index_dir = os.path.join(self.storage_today, coll, 'indexes')

        assert len(os.listdir(user_dir)) >= 2

        assert len(os.listdir(st_warcs_dir)) == 1
        assert len(os.listdir(st_index_dir)) == 1

        # TODO: readd csrf?
        #params = {'csrf': csrf_token}
        #res = self.testapp.post_json('/_delete_coll?user=someuser&coll=test-coll', params=params)
        res = self.testapp.delete('/api/v1/collection/test-coll?user=someuser')
        assert res.json == {'deleted_id': 'test-coll'}

        assert set(self.redis.hkeys('u:someuser:colls')) == {'new-coll-3', 'new-coll', 'new-coll-2'}

        #assert res.headers['Location'] == 'http://localhost:80/someuser'

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
                       username='Testauto',
                       passwd='Test12345',
                       role='archivist',
                       name='Test User')

        assert self.redis.exists('u:Testauto:info')
        assert self.redis.hget(CLIUserManager.LC_USERNAMES_KEY, 'testauto') == 'Testauto'

    def test_already_logged_in(self):
        params = {'username': 'Testauto',
                  'password': 'Test12345'}

        res = self.testapp.post_json('/api/v1/auth/login', params=params, status=403)

        assert res.json['error'] == 'already_logged_in'

        assert self.testapp.cookies.get('__test_sesh', '') != ''

    def test_logout_2(self):
        res = self.testapp.post_json('/api/v1/auth/logout', status=200)
        assert res.json['success']
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_login_another(self):
        params = {'username': 'TestAuto',
                  'password': 'Test12345'}

        res = self.testapp.post_json('/api/v1/auth/login', params=params)

        assert res.json['user']['num_collections'] == 1
        assert res.json['user']['role'] == 'archivist'
        assert res.json['user']['username'] == 'Testauto'

        assert 'max-age=' not in res.headers['Set-Cookie'].lower()

        assert self.testapp.cookies.get('__test_sesh', '') != ''

    def test_different_user_default_coll(self):
        res = self.testapp.get('/Testauto/default-collection')
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
        assert res.json == {'error': 'no_such_collection'}

    def test_logout_3(self):
        res = self.testapp.post_json('/api/v1/auth/logout', status=200)
        assert res.json['success']
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_login_3_remember_me(self):
        params = {'username': 'someuser',
                  'password': 'Password1',
                  'remember_me': True
                 }

        res = self.testapp.post_json('/api/v1/auth/login', params=params)

        assert res.json['user']['num_collections'] == 3
        assert res.json['user']['role'] == 'archivist'
        assert res.json['user']['username'] == 'someuser'

        assert 'max-age=' in res.headers['Set-Cookie'].lower()

        assert self.testapp.cookies.get('__test_sesh', '') != ''

    def test_delete_user_wrong_user(self):
        #res = self.testapp.get('/_settings')

        #csrf_token = re.search('name="csrf" value="([^\"]+)"', res.text).group(1)

        # wrong user!
        #params = {'csrf': csrf_token}
        res = self.testapp.delete('/api/v1/user/Testauto', status=404)

        assert res.json['error'] == 'not_found'

    def _test_delete_user_wrong_csrf(self):
        # right user, invalid csrf
        params = {'csrf': 'xyz'}
        res = self.testapp.post_json('/someuser/$delete', params=params, status=403)
        assert res.status_code == 403


    def test_delete_user(self):
        #res = self.testapp.get('/_settings')

        #csrf_token = re.search('name="csrf" value="([^\"]+)"', res.text).group(1)

        user_dir = os.path.join(self.warcs_dir, 'someuser')

        st_warcs_dir = os.path.join(self.storage_today, 'warcs')
        st_index_dir = os.path.join(self.storage_today, 'indexes')

        #params = {'csrf': csrf_token}
        res = self.testapp.delete('/api/v1/user/someuser')

        #TODO: make more consistent return
        assert res.json['deleted_user'] == 'someuser'

        #assert res.json['deleted_id'] == 'someuser'
        #assert res.headers['Location'] == 'http://localhost:80/'
        assert self.testapp.cookies.get('__test_sesh', '') == ''

        assert not self.redis.exists('u:someuser:info')
        assert set(self.redis.hkeys('u:someuser:colls')) == set()
        assert self.redis.sismember('s:users', 'someuser') == False

        def assert_delete():
            assert len(os.listdir(user_dir)) == 0
            assert not os.path.isdir(st_warcs_dir)
            assert not os.path.isdir(st_index_dir)

        self.sleep_try(0.3, 10.0, assert_delete)

    def test_stats(self):
        today = today_str()
        assert int(self.redis.hget(Stats.TEMP_MOVE_COUNT_KEY, today)) == 1
        assert int(self.redis.hget(Stats.TEMP_MOVE_SIZE_KEY, today)) > 0

        keys = set(self.redis.keys('st:*'))
        assert keys == {
            Stats.TEMP_MOVE_COUNT_KEY,
            Stats.TEMP_MOVE_SIZE_KEY,
            Stats.ALL_CAPTURE_TEMP_KEY,
            Stats.ALL_CAPTURE_USER_KEY,
            Stats.REPLAY_USER_KEY,
            Stats.DOWNLOADS_USER_COUNT_KEY,
            Stats.DOWNLOADS_USER_SIZE_KEY,
            Stats.DELETE_USER_KEY
        }

    def test_login_4_no_such_user(self):
        params = {'username': 'someuser',
                  'password': 'Password1'}

        res = self.testapp.post_json('/api/v1/auth/login', params=params, status=401)
        assert res.json == {"error": 'invalid_login'}

        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def _test_user_settings_error(self):
        res = self.testapp.get('/_settings', status=404)


