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
        super(TestAutoLogin, cls).setup_class(temp_worker=True)

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
        res = self.testapp.get('/_new/default-collection/rec-sesh/record/mp_/http://httpbin.org/get?food=bar')
        assert res.headers['Location'].endswith('/test/default-collection/rec-sesh/record/mp_/http://httpbin.org/get?food=bar')
        res = res.follow()
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'ts': '2016010203000000'}
        res = self.testapp.post_json('/api/v1/recordings/rec-sesh/pages?user=test&coll=default-collection', params=page)

        assert res.json == {}

    def test_api_curr_user(self):
        res = self.testapp.get('/api/v1/curr_user')
        assert res.json == {'curr_user': 'test'}



