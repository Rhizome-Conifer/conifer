from .testutils import FullStackTests

import os
import webtest
import json

from webrecorder.models.usermanager import CLIUserManager


# ============================================================================
class TestAutoLogin(FullStackTests):
    @classmethod
    def setup_class(cls, **kwargs):
        os.environ['AUTO_LOGIN_USER'] = 'test'
        super(TestAutoLogin, cls).setup_class(temp_worker=True, storage_worker=True)

        cls.manager = CLIUserManager()

    def teardown_class(cls, *args, **kwargs):
        super(TestAutoLogin, cls).teardown_class(*args, **kwargs)
        del os.environ['AUTO_LOGIN_USER']

    def test_create_user_def_coll(self):
        self.manager.create_user('test@example.com', 'test', 'TestTest123', 'archivist', 'Test')
        res = self.testapp.get('/test/default-collection')
        res.charset = 'utf-8'
        assert '"test"' in res.text

    def test_logged_in_record_1(self):
        self.set_uuids('Recording', ['rec-sesh'])
        res = self.testapp.get('/_new/default-collection/rec-sesh/record/mp_/http://httpbin.org/get?food=bar')
        assert res.headers['Location'].endswith('/test/default-collection/rec-sesh/record/mp_/http://httpbin.org/get?food=bar')
        res = res.follow()
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'ts': '2016010203000000'}
        res = self.testapp.post_json('/api/v1/recording/rec-sesh/pages?user=test&coll=default-collection', params=page)

        assert res.json == {}

    def test_api_curr_user(self):
        res = self.testapp.get('/api/v1/curr_user')
        assert res.json == {'curr_user': 'test'}

    def test_get_collection(self):
        res = self.testapp.get('/api/v1/collection/default-collection?user=test')

        assert res.json['collection']
        coll = res.json['collection']

        assert coll['public_index'] == True
        assert coll['public'] == False
        assert coll['title'] == 'Default Collection'
        assert 'This is your first collection' in coll['desc']

    def test_update_collection(self):
        params = {'desc': 'New Description',
                  'public_index': False,
                  'public': True,
                  'title': 'New Title'
                 }

        res = self.testapp.post_json('/api/v1/collection/default-collection?user=test', params=params)

        assert res.json['collection']
        coll = res.json['collection']

        assert coll['public_index'] == False
        assert coll['public'] == True
        assert coll['title'] == 'New Title'
        assert coll['desc'] == 'New Description'

    def test_create_new_coll(self):
        # Collection
        params = {'title': 'Another Coll'}

        res = self.testapp.post_json('/api/v1/collections?user=test', params=params)
        assert res.json['collection']

    def test_copy_rec(self):
        self.set_uuids('Recording', ['rec-sesh-a'])
        res = self.testapp.post_json('/api/v1/recording/rec-sesh/copy/another-coll?user=test&coll=new-title')
        assert res.json['recording']

        coll, rec = self.get_coll_rec('test', 'another-coll', 'rec-sesh-a')

        orig_coll, orig_rec = self.get_coll_rec('test', 'new-title', 'rec-sesh')

        def assert_one_dir():
            self.assert_coll_rec_warcs(coll, rec, 1, 1)

        self.sleep_try(0.2, 5.0, assert_one_dir)

        info = self.redis.hgetall('r:{0}:info'.format(rec))

        orig_info = self.redis.hgetall('r:{0}:info'.format(orig_rec))

        assert info['size'] == orig_info['size']

    def test_copy_rec_to_self_error(self):
        self.set_uuids('Recording', ['rec-sesh'])
        res = self.testapp.post_json('/api/v1/recording/rec-sesh/copy/another-coll?user=test&coll=new-title')

        assert res.json['error'] == 'copy_error'

    def test_logged_in_record_2(self):
        self.set_uuids('Recording', ['rec'])
        res = self.testapp.get('/_new/another-coll/rec/record/mp_/http://httpbin.org/get?bood=far')
        res = res.follow()
        res.charset = 'utf-8'

        coll, rec = self.get_coll_rec('test', 'another-coll', 'rec')

        assert '"bood": "far"' in res.text, res.text

        self.assert_coll_rec_warcs(coll, rec, 2, 1)


