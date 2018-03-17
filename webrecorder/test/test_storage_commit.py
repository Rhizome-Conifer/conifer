from .testutils import FullStackTests
from webrecorder.models.usermanager import CLIUserManager
from webrecorder.utils import today_str

import os
import boto3
import pytest
import base64

REC_CDXJ = 'r:500:cdxj'


# ============================================================================
class TestStorageCommit(FullStackTests):
    @classmethod
    def setup_class(cls):
        os.environ['AUTO_LOGIN_USER'] = 'test'
        super(TestStorageCommit, cls).setup_class(extra_config_file='test_cdxj_cache_config.yaml',
                                                  storage_worker=True)

        cls.redis.set('n:recs:count', 499)
        cls.redis.set('n:colls:count', 99)

        cls.user_manager = CLIUserManager()
        cls.user_manager.create_user('user@example.com', 'test', 'TestTest456', 'archivist', 'Test User')

    @classmethod
    def teardown_class(cls):
        del os.environ['AUTO_LOGIN_USER']
        super(TestStorageCommit, cls).teardown_class()

    def assert_exists(self, key, exists):
        def func():
            assert exists == self.redis.exists(key)

        return func


# ============================================================================
class TestLocalStorageCommit(TestStorageCommit):
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

        self.sleep_try(0.1, 1.0, self.assert_exists(REC_CDXJ, True))

    def test_warcs_in_storage(self):
        today = today_str()
        storage_dir = os.path.join(self.storage_dir, today)

        # initial user dir
        user_dir = os.path.join(self.warcs_dir, 'test')
        assert len(os.listdir(user_dir)) == 1

        def assert_in_store():
            # moved to store dir
            assert set(os.listdir(storage_dir)) == {'warcs', 'indexes'}
            assert len(os.listdir(os.path.join(storage_dir, 'warcs'))) == 1
            assert len(os.listdir(os.path.join(storage_dir, 'indexes'))) == 1

            # user dir removed
            assert not os.path.isdir(user_dir)

        self.sleep_try(0.1, 10.0, assert_in_store)

        coll, rec = self.get_coll_rec('test', 'test-migrate', 'rec')

        result = self.redis.hgetall('r:{rec}:warc'.format(rec=REC_CDXJ))
        storage_dir = storage_dir.replace(os.path.sep, '/')
        for key in result:
            assert storage_dir in result[key]

    def test_replay_1(self):
        res = self.testapp.get('/test/default-collection/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_delete_storage_with_coll(self):
        res = self.testapp.delete('/api/v1/collections/default-collection?user=test')

        assert res.json == {'deleted_id': 'default-collection'}

        storage_dir = os.path.join(self.storage_dir, today_str())

        def assert_deleted():
            # moved to store dir
            assert set(os.listdir(storage_dir)) == {'warcs', 'indexes'}
            assert len(os.listdir(os.path.join(storage_dir, 'warcs'))) == 0
            assert len(os.listdir(os.path.join(storage_dir, 'indexes'))) == 0

        self.sleep_try(0.1, 10.0, assert_deleted)


# ============================================================================
class TestS3Storage(TestStorageCommit):
    @classmethod
    def setup_class(cls):

        # create a random root key within storage-test path
        cls.random = base64.b32encode(os.urandom(5)).decode('utf-8')
        root = 's3://webrecorder-builds/storage-test/' + cls.random + '/'

        # attempt to write empty object to s3, if no write access, then skip all the tests
        try:
            cls.s3 = boto3.client('s3')
            cls.s3.put_object(Bucket='webrecorder-builds', Key=root + 'empty')
        except:
            pytest.skip('Skipping S3 Stroage Tests, No S3 Write Access')

        os.environ['DEFAULT_STORAGE'] = 's3'
        os.environ['S3_ROOT'] = root

        super(TestS3Storage, cls).setup_class()

    @classmethod
    def teardown_class(cls):
        # Delete temp object
        try:
            cls.s3.delete_object(Bucket='webrecorder-builds', Key=root + 'empty')
        except:
            pass

        del os.environ['DEFAULT_STORAGE']
        del os.environ['S3_ROOT']
        super(TestS3Storage, cls).teardown_class()

    def _list_keys(self):
        return [obj['Key'] for obj in self.s3.list_objects(Bucket='webrecorder-builds',
                                                           Prefix='storage-test/' + self.random).get('Contents', []) if obj['Size'] > 0]

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

        self.sleep_try(0.1, 1.0, self.assert_exists(REC_CDXJ, True))

    def test_warcs_in_storage(self):
        today = today_str()
        storage_dir = os.environ['S3_ROOT'] + '/' + today

        # initial user dir
        user_dir = os.path.join(self.warcs_dir, 'test')
        assert len(os.listdir(user_dir)) == 1

        def assert_in_store():
            keys = self._list_keys()
            assert len(keys) == 2

            assert today in keys[0]
            assert keys[0].endswith('.cdxj')

            assert today in keys[1]
            assert keys[1].endswith('.warc.gz')

            # user dir removed
            assert not os.path.isdir(user_dir)

        self.sleep_try(1.0, 10.0, assert_in_store)

        coll, rec = self.get_coll_rec('test', 'test-migrate', 'rec')

        result = self.redis.hgetall('r:{rec}:warc'.format(rec=REC_CDXJ))
        for key in result:
            assert result[key].startswith(os.environ['S3_ROOT'])

    def test_delete_storage_with_coll(self):
        res = self.testapp.delete('/api/v1/collections/default-collection?user=test')

        assert res.json == {'deleted_id': 'default-collection'}

        def assert_deleted():
            keys = self._list_keys()
            assert len(keys) == 0

        self.sleep_try(1.0, 10.0, assert_deleted)

