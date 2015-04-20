import webtest
import cookielib

import os
import shutil
import tempfile

from app import init
from auth import Cork, RedisBackend
from redis import StrictRedis

REDIS_URL = 'redis://127.0.0.1:6379/11'

jar = None
root_dir = None


class InitCork(Cork):
    @property
    def current_user(self):
        class MockUser(object):
            @property
            def level(self):
                return 100
        return MockUser()


def setup_module():
    global root_dir
    root_dir = tempfile.mkdtemp()

    global jar
    jar = cookielib.CookieJar()
    init_auth()

def teardown_module():
    global root_dir
    shutil.rmtree(root_dir)

def init_auth():
    redis_obj = StrictRedis.from_url(REDIS_URL)
    redis_obj.flushdb()
    backend = RedisBackend(redis_obj)

    cork = InitCork(backend=backend)
    cork.create_role('archivist', 50)
    cork.create_user('userfoo', 'archivist', 'test', 'userfoo@userfoo', 'userfoo')
    cork.create_user('other', 'archivist', 'test', 'userfoo@userfoo', 'userfoo')
    cork.create_user('another', 'archivist', 'test', 'userfoo@userfoo', 'userfoo')


class TestWebRecorder:
    def setup(self):
        app = init(store_root=root_dir, redis_url=REDIS_URL)
        self.testapp = webtest.TestApp(app, cookiejar=jar)

    def _assert_basic_html(self, resp):
        assert resp.status_int == 200
        assert resp.content_type == 'text/html'
        assert resp.content_length > 0

    def test_home(self):
        resp = self.testapp.get('/')
        assert 'webrecorder.io' in resp.body
        assert 'Login' in resp.body

    def test_user(self):
        resp = self.testapp.get('/userfoo')
        assert 'userfoo Archive' in resp.body
        assert 'Create new Collection' not in resp.body

    def test_login(self):
        resp = self.testapp.get('/_login')
        self._assert_basic_html(resp)

        assert 'Please log-in' in resp.body
        form = resp.forms[0]
        form['username'] = 'userfoo'
        form['password'] = 'test'

        resp = form.submit()
        assert resp.status_int == 302
        assert resp.headers['Location'] == 'http://localhost:80/userfoo'

    def test_li_home(self):
        resp = self.testapp.get('/')
        assert 'userfoo' in resp.body
        assert 'Logout' in resp.body
        assert 'Login' not in resp.body

    def test_li_user(self):
        resp = self.testapp.get('/userfoo')
        assert 'Test Collection' not in resp.body
        assert 'Create new Collection' in resp.body

    def test_li_create(self):
        resp = self.testapp.get('/_create')

        assert 'Create a new collection' in resp.body
        form = resp.forms[0]
        form['collection'] = 'test-abc'
        form['title'] = 'Test Collection'

        resp = form.submit()
        assert resp.status_int == 302
        assert resp.headers['Location'] == 'http://localhost:80/userfoo/test-abc'

    def test_li_user_with_coll(self):
        resp = self.testapp.get('/userfoo/test-abc')
        assert 'Created collection <b>test-abc</b>' in resp.body
        assert '/test-abc' in resp.body
        assert 'Test Collection' in resp.body

