from .testutils import FullStackTests

import os
import webtest
import json

from webrecorder.models.usermanager import CLIUserManager
from warcio import ArchiveIterator


# ============================================================================
class TestUpload(FullStackTests):
    @classmethod
    def setup_class(cls, **kwargs):
        super(TestUpload, cls).setup_class(temp_worker=True)

        cls.manager = CLIUserManager()

        cls.warc = None

        cls.test_upload_warc = os.path.join(cls.get_curr_dir(), 'warcs', 'test_3_15_upload.warc.gz')

    def test_upload_anon(self):
        with open(self.test_upload_warc, 'rb') as fh:
            res = self.testapp.put('/_upload?filename=example2.warc.gz', params=fh.read())

        assert res.json == {'error_message': 'Sorry, uploads only available for logged-in users'}

    def test_create_user_def_coll(self):
        self.manager.create_user('test@example.com', 'test', 'TestTest123', 'archivist', 'Test')

    def test_login(self):
        params = {'username': 'test',
                  'password': 'TestTest123',
                 }

        res = self.testapp.post_json('/api/v1/login', params=params)

        assert res.json == {'anon': False,
                            'coll_count': 1,
                            'role': 'archivist',
                            'username': 'test',
                           }

        assert self.testapp.cookies.get('__test_sesh', '') != ''

    def test_default_coll(self):
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

    def test_logged_in_download_coll(self):
        res = self.testapp.get('/test/default-collection/$download')

        assert res.headers['Content-Disposition'].startswith("attachment; filename*=UTF-8''default-collection-")

        TestUpload.warc = self._get_dechunked(res.body)

    def test_read_warcinfo(self):
        self.warc.seek(0)
        metadata = []
        for record in ArchiveIterator(self.warc):
            if record.rec_type == 'warcinfo':
                stream = record.content_stream()
                while True:
                    line = stream.readline().decode('utf-8')
                    if line.startswith('json-metadata'):
                        metadata.append(json.loads(line.split(' ', 1)[1]))
                    if not line:
                        break

        assert len(metadata) == 2
        assert metadata[0]['type'] == 'collection'
        assert set(metadata[0].keys()) == {'created_at_date', 'updated_at_date',
                                           'title', 'desc', 'type', 'size'}

        assert metadata[0]['title'] == 'Default Collection'
        assert 'This is your first' in metadata[0]['desc']

        assert metadata[1]['type'] == 'recording'
        assert set(metadata[1].keys()) == {'created_at_date', 'updated_at_date',
                                           'title', 'desc', 'type', 'size',
                                           'pages'}

        assert metadata[1]['title'].startswith('Recording on ')
        assert metadata[1]['desc'] == 'rec-sesh'

        assert metadata[0]['created_at_date'] <= metadata[0]['updated_at_date']

        TestUpload.created_at_0 = metadata[0]['created_at_date']
        TestUpload.created_at_1 = metadata[1]['created_at_date']

        TestUpload.updated_at_0 = metadata[0]['updated_at_date']
        TestUpload.updated_at_1 = metadata[1]['updated_at_date']

    def test_logged_in_upload_coll(self):
        res = self.testapp.put('/_upload?filename=example.warc.gz', params=self.warc.getvalue())
        res.charset = 'utf-8'
        assert res.json['user'] == 'test'
        assert res.json['upload_id'] != ''

        upload_id = res.json['upload_id']
        res = self.testapp.get('/_upload/' + upload_id + '?user=test')

        assert res.json['coll'] == 'default-collection-2'
        assert res.json['coll_title'] == 'Default Collection'
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

    def test_uploaded_coll_info(self):
        res = self.testapp.get('/api/v1/collection/default-collection-2?user=test')

        assert res.json['collection']
        collection = res.json['collection']

        assert 'This is your first collection' in collection['desc']
        assert collection['id'] == 'default-collection-2'
        assert collection['title'] == 'Default Collection'

        assert collection['created_at'] == TestUpload.created_at_0
        assert collection['recordings'][0]['created_at'] == TestUpload.created_at_1

        assert collection['updated_at'] >= TestUpload.updated_at_0
        assert collection['recordings'][0]['updated_at'] >= TestUpload.updated_at_1

    def test_upload_3_x_warc(self):
        with open(self.test_upload_warc, 'rb') as fh:
            res = self.testapp.put('/_upload?filename=example2.warc.gz', params=fh.read())

        res.charset = 'utf-8'
        assert res.json['user'] == 'test'
        assert res.json['upload_id'] != ''

        upload_id = res.json['upload_id']
        res = self.testapp.get('/_upload/' + upload_id + '?user=test')

        assert res.json['coll'] == 'temporary-collection'
        assert res.json['coll_title'] == 'Temporary Collection'
        assert res.json['filename'] == 'example2.warc.gz'
        assert res.json['files'] == 1
        assert res.json['total_size'] == 5192

        def assert_finished():
            res = self.testapp.get('/_upload/' + upload_id + '?user=test')
            assert res.json['size'] >= res.json['total_size']

        self.sleep_try(0.1, 5.0, assert_finished)

    def test_replay_2(self):
        res = self.testapp.get('/test/temporary-collection/mp_/http://example.com/')
        res.charset = 'utf-8'

        assert 'Example Domain' in res.text, res.text

    def test_uploaded_coll_info_2(self):
        res = self.testapp.get('/api/v1/collection/temporary-collection?user=test')

        assert res.json['collection']
        collection = res.json['collection']

        assert "This collection doesn't yet have" in collection['desc']
        assert collection['id'] == 'temporary-collection'
        assert collection['title'] == 'Temporary Collection'

    def test_upload_force_coll(self):
        with open(self.test_upload_warc, 'rb') as fh:
            res = self.testapp.put('/_upload?filename=example2.warc.gz&force-coll=default-collection', params=fh.read())

        res.charset = 'utf-8'
        assert res.json['user'] == 'test'
        assert res.json['upload_id'] != ''

        upload_id = res.json['upload_id']
        res = self.testapp.get('/_upload/' + upload_id + '?user=test')

        assert res.json['coll'] == 'default-collection'
        assert res.json['coll_title'] == 'Default Collection'
        assert res.json['filename'] == 'example2.warc.gz'
        assert res.json['files'] == 1
        assert res.json['total_size'] >= 3000

        def assert_finished():
            res = self.testapp.get('/_upload/' + upload_id + '?user=test')
            assert res.json['size'] >= res.json['total_size']

        self.sleep_try(0.1, 5.0, assert_finished)

    def test_replay_3(self):
        res = self.testapp.get('/test/default-collection/mp_/http://example.com/')
        res.charset = 'utf-8'

        assert 'Example Domain' in res.text, res.text

        res = self.testapp.get('/api/v1/collection/default-collection?user=test')
        assert len(res.json['collection']['recordings']) == 2

    def test_logout_1(self):
        res = self.testapp.get('/_logout')
        assert res.headers['Location'] == 'http://localhost:80/'
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_replay_error_logged_out(self):
        res = self.testapp.get('/test/default-collection/mp_/http://example.com/', status=404)

    def test_upload_anon_2(self):
        with open(self.test_upload_warc, 'rb') as fh:
            res = self.testapp.put('/_upload?filename=example2.warc.gz', params=fh.read())

        assert res.json == {'error_message': 'Sorry, uploads only available for logged-in users'}




