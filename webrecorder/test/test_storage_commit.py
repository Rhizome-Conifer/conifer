from .testutils import FullStackTests
from webrecorder.models.usermanager import CLIUserManager
from webrecorder.utils import today_str

import os
import boto3
import pytest
import base64
import requests

from urllib.parse import urlsplit
from itertools import count

REC_CDXJ = 'r:500:cdxj'
REC_WARC = 'r:500:warc'
REC_INFO = 'r:500:info'
COLL_ID = '100'


# ============================================================================
class BaseStorageCommit(FullStackTests):
    @classmethod
    def setup_class(cls):
        os.environ['AUTO_LOGIN_USER'] = 'test'
        super(BaseStorageCommit, cls).setup_class(extra_config_file='test_cdxj_cache_config.yaml',
                                                  storage_worker=True,
                                                  init_anon=False)

        cls.set_uuids('Recording', count(500))
        cls.set_uuids('Collection', count(100))

        cls.user_manager = CLIUserManager()
        cls.user_manager.create_user('user@example.com', 'test', 'TestTest456', 'archivist', 'Test User')

    @classmethod
    def teardown_class(cls):
        del os.environ['AUTO_LOGIN_USER']
        super(BaseStorageCommit, cls).teardown_class()

    def assert_exists(self, key, exists):
        def func():
            assert exists == self.redis.exists(key)

        return func

    def test_coll_exists(self):
        res = self.testapp.get('/test/default-collection')
        res.charset = 'utf-8'
        assert '"test"' in res.text

    def test_record_1(self):
        res = self.testapp.get('/_new/default-collection/rec/record/mp_/http://httpbin.org/get?food=bar')
        assert res.status_code == 302
        res = res.follow()
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        self.sleep_try(0.3, 10.0, self.assert_exists(REC_CDXJ, True))

    def test_record_2_temp(self):
        res = self.testapp.get('/_new/default-collection/rec/record/mp_/http://httpbin.org/get?food=bar')
        assert res.status_code == 302
        res = res.follow()
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        self.sleep_try(0.5, 10.0, self.assert_exists(REC_CDXJ, True))

    def test_delete_rec(self):
        user_dir = os.path.join(self.warcs_dir, 'test')
        assert len(os.listdir(user_dir)) == 2

        res = self.testapp.delete('/api/v1/recording/501?user=test&coll=default-collection')

        assert res.json == {'deleted_id': '501'}

        def assert_deleted_rec():
            assert len(os.listdir(user_dir)) == 1

        self.sleep_try(0.5, 10.0, assert_deleted_rec)

    def test_warcs_in_storage(self):
        # initial user dir
        user_dir = os.path.join(self.warcs_dir, 'test')
        assert len(os.listdir(user_dir)) == 1

        self.sleep_try(0.5, 10.0, self.assert_in_store(COLL_ID))

        def assert_user_dir_empty():
            # user dir removed or empty
            assert not os.path.isdir(user_dir) or len(os.listdir(user_dir)) == 0

        self.sleep_try(0.1, 10.0, assert_user_dir_empty)

        #coll, rec = self.get_coll_rec('test', 'test-migrate', '500')
        coll = '100'
        rec = '500'

        result = self.redis.hgetall('c:{coll}:warc'.format(coll=COLL_ID))
        assert len(result) == 1
        for key in result:
            self.assert_warc_key(result[key])

    def test_replay_1(self):
        def assert_replay():
            res = self.testapp.get('/test/default-collection/mp_/http://httpbin.org/get?food=bar')
            res.charset = 'utf-8'

            assert '"food": "bar"' in res.text, res.text

        self.sleep_try(1.0, 10.0, assert_replay)

    def test_download(self):
        assert self.redis.hget(REC_INFO, '@index_file') != None

        res = self.testapp.get('/test/default-collection/$download')

        assert len(res.body) == int(res.headers['Content-Length'])

        assert res.headers['Content-Disposition'].startswith("attachment; filename*=UTF-8''default-collection-")

    def test_wasapi_list(self):
        assert self.redis.hget(REC_INFO, '@index_file') is not None
        params = {'user': 'test'}
        res = self.testapp.get('/api/v1/download/webdata', params=params)
        result = self.redis.hgetall('c:{coll}:warc'.format(coll=COLL_ID))
        assert res.json['files'][0].get('filename') == list(result.keys())[0]

        self.assert_wasapi_locations(res.json['files'][0], verify_only=True)

    def test_wasapi_download(self):
        assert self.redis.hget(REC_INFO, '@index_file') is not None
        params = {'user': 'test'}
        res = self.testapp.get('/api/v1/download/webdata', params=params)

        self.assert_wasapi_locations(res.json['files'][0], verify_only=False)

    def test_create_new_coll(self):
        # Collection
        params = {'title': 'Another Coll'}

        res = self.testapp.post_json('/api/v1/collections?user=test', params=params)
        assert res.json['collection']

    def test_copy_rec(self):
        # initial user dir
        user_dir = os.path.join(self.warcs_dir, 'test')
        assert len(os.listdir(user_dir)) == 0

        res = self.testapp.post_json('/api/v1/recording/500/copy/another-coll?user=test&coll=default-collection')

        coll, rec = self.get_coll_rec('test', 'another-coll', '502')

        orig_coll, orig_rec = self.get_coll_rec('test', 'default-collection', '500')

        def assert_copied():
            self.assert_coll_rec_warcs(coll, rec, 1, 1)

        self.sleep_try(0.2, 10.0, assert_copied)

        info = self.redis.hgetall('r:{0}:info'.format(rec))

        orig_info = self.redis.hgetall('r:{0}:info'.format(orig_rec))

        assert info['size'] == orig_info['size']

        self.sleep_try(0.5, 10.0, self.assert_in_store('101'))

        def assert_user_dir_empty():
            # user dir removed or empty
            assert not os.path.isdir(user_dir) or len(os.listdir(user_dir)) == 0

        self.sleep_try(0.1, 10.0, assert_user_dir_empty)

    def test_replay_2_copy(self):
        def assert_replay():
            res = self.testapp.get('/test/another-coll/mp_/http://httpbin.org/get?food=bar')
            res.charset = 'utf-8'

            assert '"food": "bar"' in res.text, res.text

        self.sleep_try(1.0, 10.0, assert_replay)


    def test_delete_storage_with_coll(self):
        res = self.testapp.delete('/api/v1/collection/default-collection?user=test')

        assert res.json == {'deleted_id': 'default-collection'}

        res = self.testapp.delete('/api/v1/collection/another-coll?user=test')

        assert res.json == {'deleted_id': 'another-coll'}

        self.sleep_try(0.5, 10.0, self.assert_deleted)


# ============================================================================
class TestLocalStorageCommit(BaseStorageCommit):
    def assert_in_store(self, coll_id):
        def check():
            today = today_str()
            storage_dir = os.path.join(self.storage_dir, today, coll_id)

            # moved to store dir
            assert set(os.listdir(storage_dir)) == {'warcs', 'indexes'}
            assert len(os.listdir(os.path.join(storage_dir, 'warcs'))) == 1
            assert len(os.listdir(os.path.join(storage_dir, 'indexes'))) == 1

        return check

    def assert_deleted(self):
        storage_dir = os.path.join(self.storage_dir, today_str())

        assert not os.path.isdir(storage_dir)
        #assert set(os.listdir(storage_dir)) == {}
        #assert len(os.listdir(os.path.join(storage_dir, 'warcs'))) == 0
        #assert len(os.listdir(os.path.join(storage_dir, 'indexes'))) == 0

    def assert_warc_key(self, key):
        storage_dir = os.environ['STORAGE_ROOT'].replace(os.path.sep, '/')
        assert storage_dir in key

    def assert_wasapi_locations(self, file_entry, verify_only=True):
        locations = file_entry.get('locations', [])
        assert list(file_entry.get('checksums').keys())[0] == 'md5'
        assert len(locations) == 1
        if verify_only:
            return

        downloaded = self.testapp.get(locations[0])
        assert len(downloaded.body) == int(downloaded.headers['Content-Length'])
        result = self.redis.hgetall('c:{coll}:warc'.format(coll=COLL_ID))
        assert downloaded.headers['Content-Disposition'].startswith("attachment; filename*=UTF-8''" + list(result.keys())[0])


# ============================================================================
class TestS3Storage(BaseStorageCommit):
    @classmethod
    def setup_class(cls):
        # create a random root key within storage-test path
        cls.random = base64.b32encode(os.urandom(5)).decode('utf-8')

        root = os.environ.get('WR_TEST_S3_ROOT', 's3://webrecorder-builds/storage-test/')
        root += cls.random + '/'

        parts = urlsplit(root)

        cls.bucket = parts.netloc

        # don't include starting /
        cls.root_path = parts.path[1:]

        # attempt to write empty object to s3, if no write access, then skip all the tests
        try:
            cls.s3 = boto3.client('s3')
            cls.s3.put_object(Bucket=cls.bucket, Key=cls.root_path + 'empty')
        except:
            pytest.skip('Skipping S3 Storage Tests, No S3 Write Access')

        os.environ['DEFAULT_STORAGE'] = 's3'
        os.environ['S3_ROOT'] = root

        super(TestS3Storage, cls).setup_class()

    @classmethod
    def teardown_class(cls):
        # Delete temp object
        try:
            cls.s3.delete_object(Bucket=cls.bucket, Key=cls.root_path + 'empty')
        except:
            pass

        del os.environ['DEFAULT_STORAGE']
        del os.environ['S3_ROOT']
        super(TestS3Storage, cls).teardown_class()

    def _list_keys(self):
        return [obj['Key'] for obj in self.s3.list_objects(Bucket=self.bucket,
                                                           Prefix=self.root_path).get('Contents', []) if obj['Size'] > 0]

    def assert_in_store(self, coll_id):
        def check():
            today = today_str()
            storage_dir = os.environ['S3_ROOT'] + today

            keys = self._list_keys()
            assert len(keys) == 2

            assert today in keys[0]
            assert keys[0].endswith('.cdxj')

            assert today in keys[1]
            assert keys[1].endswith('.warc.gz')

        return check

    def assert_deleted(self):
        keys = self._list_keys()
        assert len(keys) == 0

    def assert_warc_key(self, key):
        assert key.startswith(os.environ['S3_ROOT'])

    def assert_wasapi_locations(self, file_entry, verify_only=True):
        locations = file_entry.get('locations', [])
        hash_type = list(file_entry.get('checksums').keys())[0]
        assert hash_type == 's3etag' or hash_type == 'md5'
        assert len(locations) == 2
        if verify_only:
            return

        assert 's3.' in locations[0]
        s3_downloaded = requests.get(locations[0])

        downloaded = self.testapp.get(locations[1])
        assert len(downloaded.body) == int(downloaded.headers['Content-Length'])
        result = self.redis.hgetall('c:{coll}:warc'.format(coll=COLL_ID))
        assert downloaded.headers['Content-Disposition'].startswith("attachment; filename*=UTF-8''" + list(result.keys())[0])

        # ensure both locations serve exact same content
        assert s3_downloaded.content == downloaded.body

