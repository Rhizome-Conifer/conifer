from .testutils import FullStackTests

import os
import webtest
import json

from webrecorder.models.usermanager import CLIUserManager


# ============================================================================
class TestAutoLogin(FullStackTests):
    ID_1 = '9871d09bf7'

    ID_2 = 'b8b7f9b7b3'
    ID_3 = '2680c6cb2e'

    @classmethod
    def setup_class(cls, **kwargs):
        os.environ['AUTO_LOGIN_USER'] = 'test'
        super(TestAutoLogin, cls).setup_class(temp_worker=True, storage_worker=True,
                                              init_anon=False)

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
        res = self.testapp.get('/_new/default-collection/rec-sesh/record/mp_/http://httpbin.org/get?food=bar&other=/record/bar')
        assert res.headers['Location'].endswith('/test/default-collection/rec-sesh/record/mp_/http://httpbin.org/get?food=bar&other=/record/bar')
        res = res.follow()
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text
        assert '"other": "/record/bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'ts': '2016010203000000'}
        res = self.testapp.post_json('/api/v1/recording/rec-sesh/pages?user=test&coll=default-collection', params=page)

        assert res.json['page_id'] == self.ID_1

    def test_logged_in_record_record_in_url(self):
        # record 404 of path with '/record' in url
        res = self.testapp.get('/test/default-collection/rec-sesh/record/mp_/http://httpbin.org/get/record/bar', status=404)

        assert 'Not Found' in res.text

    def test_logged_in_replay_record_in_url(self):
        # replay same 404 of url with '/record' in url
        res = self.testapp.get('/test/default-collection/mp_/http://httpbin.org/get/record/bar', status=404)

        assert 'Not Found' in res.text

    def test_api_curr_user(self):
        res = self.testapp.get('/api/v1/auth/curr_user')
        assert res.json['user']['username'] == 'test'

    def test_get_collection(self):
        res = self.testapp.get('/api/v1/collection/default-collection?user=test')

        assert res.json['collection']
        coll = res.json['collection']

        assert coll['public_index'] == False
        assert coll['public'] == False
        assert coll['title'] == 'Default Collection'
        assert 'This is your first collection' in coll['desc']

        assert coll['pages'] == [{'id': self.ID_1, 'rec': 'rec-sesh', 'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'timestamp': ''}]

    def test_update_collection(self):
        params = {'desc': 'New Description',
                  'public_index': True,
                  'public': True,
                  'title': 'New Title'
                 }

        res = self.testapp.post_json('/api/v1/collection/default-collection?user=test', params=params)

        assert res.json['collection']
        coll = res.json['collection']

        assert coll['public_index'] == True
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

    def test_copy_rec_again_same_coll(self):
        self.set_uuids('Recording', ['rec-sesh-b'])
        res = self.testapp.post_json('/api/v1/recording/rec-sesh/copy/another-coll?user=test&coll=new-title')

        assert res.json['recording']

        coll, rec = self.get_coll_rec('test', 'another-coll', 'rec-sesh-b')

        orig_coll, orig_rec = self.get_coll_rec('test', 'new-title', 'rec-sesh')

        def assert_one_dir():
            self.assert_coll_rec_warcs(coll, rec, 1, 1)

        self.sleep_try(0.2, 5.0, assert_one_dir)

        info = self.redis.hgetall('r:{0}:info'.format(rec))

        orig_info = self.redis.hgetall('r:{0}:info'.format(orig_rec))

        assert info['size'] == orig_info['size']

    def test_get_collection_2(self):
        res = self.testapp.get('/api/v1/collection/another-coll?user=test')

        coll = res.json['collection']

        assert coll['public_index'] == False
        assert coll['public'] == False
        assert coll['title'] == 'Another Coll'
        assert coll['desc'] == ''

        assert len(coll['pages']) == 2

        assert {'id': self.ID_2, 'rec': 'rec-sesh-a', 'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'timestamp': ''} in coll['pages']
        assert {'id': self.ID_3, 'rec': 'rec-sesh-b', 'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'timestamp': ''} in coll['pages']

    def test_logged_in_record_2(self):
        self.set_uuids('Recording', ['rec'])
        res = self.testapp.get('/_new/another-coll/rec/record/mp_/http://httpbin.org/get?bood=far')
        res = res.follow()
        res.charset = 'utf-8'

        coll, rec = self.get_coll_rec('test', 'another-coll', 'rec')

        assert '"bood": "far"' in res.text, res.text

        self.assert_coll_rec_warcs(coll, rec, 2, 1)

    def test_delete_empty_rec(self):
        self.set_uuids('Recording', ['empty'])
        res = self.testapp.post('/api/v1/recordings?user=test&coll=another-coll')
        assert res.json['recording']['id'] == 'empty'

        res = self.testapp.delete('/api/v1/recording/empty?user=test&coll=another-coll')
        assert res.json['deleted_id'] == 'empty'


