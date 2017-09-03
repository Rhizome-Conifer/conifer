from .testutils import FullStackTests

import webrecorder.redisman
import gevent
from webrecorder.redisman import init_manager_for_cli

from webrecorder.admin import create_user
import os

import webtest

from webrecorder.rec.tempchecker import TempChecker
from webrecorder.rec.worker import Worker
import gevent


# ============================================================================
class TestUpload(FullStackTests):
    @classmethod
    def setup_class(cls, **kwargs):
        os.environ['AUTO_LOGIN_USER'] = 'test'
        super(TestUpload, cls).setup_class(**kwargs)

        cls.manager = init_manager_for_cli()

        cls.warc = None

        cls.worker = Worker(TempChecker)
        gevent.spawn(cls.worker.run)

    def teardown_class(cls, *args, **kwargs):
        cls.worker.stop()

        super(TestUpload, cls).teardown_class(*args, **kwargs)
        del os.environ['AUTO_LOGIN_USER']

    def test_create_user_def_coll(self):
        create_user(self.manager, 'test@example.com', 'test', 'TestTest123', 'archivist', 'Test')
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
        res = self.testapp.post('/api/v1/recordings/rec-sesh/pages?user=test&coll=default-collection', params=page)

        assert res.json == {}

    def test_logged_in_download_coll(self):
        res = self.testapp.get('/test/default-collection/$download')

        assert res.headers['Content-Disposition'].startswith("attachment; filename*=UTF-8''default-collection-")

        TestUpload.warc = self._get_dechunked(res.body)

    def test_logged_in_upload_coll(self):
        res = self.testapp.put('/_upload?filename=example.warc.gz', params=self.warc.getvalue())
        res.charset = 'utf-8'
        assert res.json['user'] == 'test'
        assert res.json['upload_id'] != ''

        upload_id = res.json['upload_id']
        res = self.testapp.get('/_upload/' + upload_id + '?user=test')

        assert res.json['coll'] == 'default-collection-2'
        assert res.json['coll_title'] == 'Default Collection 2'
        assert res.json['filename'] == 'example.warc.gz'
        assert res.json['files'] == 1
        assert res.json['total_size'] >= 3000

        def assert_finished():
            res = self.testapp.get('/_upload/' + upload_id + '?user=test')
            assert res.json['size'] >= res.json['total_size']

        self.sleep_try(0.1, 5.0, assert_finished)

    def test_logged_in_replay(self):
        res = self.testapp.get('/test/default-collection-2/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text
