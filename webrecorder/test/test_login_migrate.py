from .testutils import FullStackTests

import os
import webtest
import time

from webrecorder.models.usermanager import CLIUserManager


# ============================================================================
class TestLoginMigrate(FullStackTests):
    @classmethod
    def setup_class(cls, **kwargs):
        super(TestLoginMigrate, cls).setup_class(extra_config_file='test_cdxj_cache_config.yaml',
                                                 storage_worker=True)

        cls.user_manager = CLIUserManager()

    def test_record_1(self):
        res = self.testapp.get('/_new/temp/rec/record/mp_/http://httpbin.org/get?food=bar')
        assert res.status_code == 302
        res = res.follow()
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_api_curr_user(self):
        res = self.testapp.get('/api/v1/curr_user')
        assert res.json == {'curr_user': self.anon_user}

    def test_api_temp_user(self):
        res = self.testapp.get('/api/v1/temp-users/' + self.anon_user)

        assert res.json['created_at'] != ''
        assert res.json['max_size'] == '1000000000'
        assert res.json['rec_count'] == 1
        assert res.json['ttl'] > 0

        size = int(res.json['size'])
        max_size = int(res.json['max_size'])
        assert res.json['space_utilization'] == {
            'available': max_size - size,
            'total': max_size,
            'used': size
        }

    def test_warcs_in_temp_dir(self):
        user_dir = os.path.join(self.warcs_dir, self.anon_user)

        def assert_one_dir():
            assert len(os.listdir(user_dir)) == 1

        self.sleep_try(0.1, 10.0, assert_one_dir)

    def test_create_user_def_coll(self):
        self.user_manager.create_user('test@example.com', 'test', 'TestTest123', 'archivist', 'Test')

        # user exists
        res = self.testapp.get('/test')

        # default collection not public
        res = self.testapp.get('/test/default-collection', status=404)

    def test_api_test_non_temp_user(self):
        res = self.testapp.get('/api/v1/temp-users/test', status=404)

    def test_login_fail_no_migrate_name(self):
        params = {'username': 'test',
                  'password': 'TestTest123',

                  'moveTemp': '1'
                 }

        res = self.testapp.post_json('/api/v1/login', params=params, status=401)

        assert res.json == {'error': 'Invalid new collection name, please pick a different name'}

        assert self.testapp.cookies.get('__test_sesh', '') != ''

        res = self.testapp.get('/api/v1/curr_user')
        assert res.json == {'curr_user': self.anon_user}

    def test_login_fail_dupe_coll_name(self):
        params = {'username': 'test',
                  'password': 'TestTest123',

                  'toColl': 'default-collection',
                  'moveTemp': True,
                 }

        res = self.testapp.post_json('/api/v1/login', params=params, status=401)

        assert res.json == {'error':  'Collection "default-collection" already exists'}

        assert self.testapp.cookies.get('__test_sesh', '') != ''

        res = self.testapp.get('/api/v1/curr_user')
        assert res.json == {'curr_user': self.anon_user}

    def test_login(self):
        params = {'username': 'test',
                  'password': 'TestTest123',

                  'toColl': 'Test Migrate',
                  'moveTemp': True,
                 }

        res = self.testapp.post_json('/api/v1/login', params=params)

        assert res.json == {'anon': False,
                            'coll_count': 2,
                            'role': 'archivist',
                            'username': 'test',
                            'new_coll_name': 'test-migrate'
                           }

        assert self.testapp.cookies.get('__test_sesh', '') != ''

        res = self.testapp.get('/api/v1/curr_user')
        assert res.json == {'curr_user': 'test'}

    def test_default_collection_exists(self):
        # default collection exists
        res = self.testapp.get('/test/default-collection')
        res.charset = 'utf-8'
        assert '"test"' in res.text

    def test_login_replay(self):
        res = self.testapp.get('/test/test-migrate/mp_/http://httpbin.org/get?food=bar')

        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        res = self.testapp.get('/api/v1/curr_user')
        assert res.json == {'curr_user': 'test'}

    def test_warcs_in_storage(self):
        user_dir = os.path.join(self.warcs_dir, 'test')

        coll = None

        def assert_one_dir():
            coll_dir = os.path.join(self.storage_today, coll)
            assert set(os.listdir(coll_dir)) == {'warcs', 'indexes'}
            assert len(os.listdir(os.path.join(coll_dir, 'warcs'))) == 1
            assert len(os.listdir(os.path.join(coll_dir, 'indexes'))) == 1

            # no data in user_dir
            user_data = os.listdir(user_dir)
            assert len(user_data) == 0

        coll, rec = self.get_coll_rec('test', 'test-migrate', 'rec')

        self.sleep_try(0.2, 20.0, assert_one_dir)

        result = self.redis.hgetall('r:{rec}:warc'.format(rec=rec))
        self.storage_today = self.storage_today.replace(os.path.sep, '/')
        for key in result:
            assert self.storage_today in result[key]

    def test_logout_1(self):
        res = self.testapp.get('/_logout')
        assert res.headers['Location'] == 'http://localhost:80/'
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_logged_out_error(self):
        res = self.testapp.get('/test/test-migrate/mp_/http://httpbin.org/get?food=bar', status=404)

        res = self.testapp.get('/api/v1/curr_user')
        assert res.json['curr_user'] != self.anon_user and res.json['curr_user'].startswith('temp-')

    def test_login_2(self):
        params = {'username': 'test',
                  'password': 'TestTest123'}

        res = self.testapp.post_json('/api/v1/login', params=params)
        assert res.json['username'] == 'test'
        assert 'new_coll_name' not in res.json['username']

    def test_delete_user(self):
        user_dir = os.path.join(self.warcs_dir, 'test')
        st_warcs_dir = os.path.join(self.storage_today, 'warcs')
        st_index_dir = os.path.join(self.storage_today, 'indexes')

        res = self.testapp.delete('/api/v1/users/test')

        assert res.json == {'deleted_user': 'test'}

        def assert_delete():
            #assert not os.path.isdir(user_dir) or
            assert len(os.listdir(user_dir)) == 0
            assert not os.path.isdir(st_warcs_dir)
            assert not os.path.isdir(st_index_dir)

        self.sleep_try(0.3, 10.0, assert_delete)



