from .testutils import FullStackTests
import time
import os
import gevent
from webrecorder.rec.storagecommitter import StorageCommitter
from webrecorder.rec.worker import Worker


# ============================================================================
class TestRecordLimits(FullStackTests):
    @classmethod
    def setup_class(cls):
        super(TestRecordLimits, cls).setup_class(extra_config_file='test_rollover_config.yaml', storage_worker=True)

        cls.user_dir = os.path.join(cls.warcs_dir, cls.anon_user)

    @classmethod
    def teardown_class(cls):
        super(TestRecordLimits, cls).teardown_class()

    def get_cdx_len(self, coll_name, rec_name):
        coll, rec = self.get_coll_rec(self.anon_user, coll_name, rec_name)
        return len(self.redis.zrange('r:{rec}:cdxj'.format(rec=rec), 0, -1))

    def _get_info(self, num_warcs=1):
        warcs = os.listdir(self.user_dir)
        assert len(warcs) == num_warcs

        warc_size = os.path.getsize(os.path.join(self.user_dir, warcs[0]))

        user_key = 'u:{user}:info'.format(user=self.anon_user)

        curr_size = int(self.redis.hget(user_key, 'size'))

        return os.path.join(self.user_dir, warcs[0]), warc_size, user_key, curr_size

    def test_record_1(self):
        self.set_uuids('Recording', ['rec'])
        res = self.testapp.get('/_new/temp/rec/record/mp_/http://httpbin.org/get?food=bar')
        assert res.headers['Location'].endswith('/' + self.anon_user + '/temp/rec/record/mp_/http://httpbin.org/get?food=bar')
        res = res.follow()
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        time.sleep(0.0)

        assert self.get_cdx_len('temp', 'rec') == 1

    def test_dont_record_2_chunked(self):
        warc_file, warc_size, user_key, curr_size = self._get_info()

        self.redis.hset(user_key, 'max_size', curr_size + 100)
        res = self.testapp.get('/{user}/temp/rec/record/mp_/http://httpbin.org/stream-bytes/1300'.format(user=self.anon_user))

        time.sleep(0.0)

        assert self.get_cdx_len('temp', 'rec') == 1
    def test_dont_record_will_exceed(self):
        warc_file, warc_size, user_key, curr_size = self._get_info()

        self.redis.hset(user_key, 'max_size', curr_size + 10)

        res = self.testapp.get('/' + self.anon_user + '/temp/rec/record/mp_/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        time.sleep(0.1)

        assert warc_size == os.path.getsize(warc_file)

        assert self.get_cdx_len('temp', 'rec') == 1

    def test_dont_record_new_rec(self):
        self.set_uuids('Recording', ['rec-2'])
        warc_file, warc_size, user_key, curr_size = self._get_info()

        self.redis.hset(user_key, 'max_size', curr_size + 10)

        res = self.testapp.get('/_new/temp/rec-2/record/mp_/http://httpbin.org/get?bood=far')
        res = res.follow()
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        time.sleep(0.1)

        assert warc_size == os.path.getsize(warc_file)

        assert len(os.listdir(self.user_dir)) == 1

        assert self.get_cdx_len('temp', 'rec-2') == 0

    def test_dont_record_at_limit(self):
        warc_file, warc_size, user_key, curr_size = self._get_info()

        self.redis.hset(user_key, 'max_size', curr_size - 1)

        res = self.testapp.get('/' + self.anon_user + '/temp/rec-2/record/mp_/http://httpbin.org/get?bood=far', status=402)

        res.charset = 'utf-8'
        assert res.status_code == 402

        assert 'out of space in your temporary' in res.text

    def test_record_again(self):
        warc_file, warc_size, user_key, curr_size = self._get_info()

        self.redis.hset(user_key, 'max_size', 10000)

        res = self.testapp.get('/' + self.anon_user + '/temp/rec/record/mp_/http://httpbin.org/get?bood=far')

        time.sleep(0.1)

        assert warc_size < os.path.getsize(warc_file)

        assert self.get_cdx_len('temp', 'rec') == 2

    def test_record_again_rollover(self):
        warc_file, warc_size, user_key, curr_size = self._get_info()

        self.redis.hset(user_key, 'max_size', 10000)

        res = self.testapp.get('/' + self.anon_user + '/temp/rec/record/mp_/http://httpbin.org/get?bood=far2')

        time.sleep(0.1)

        assert warc_size == os.path.getsize(warc_file)

        assert len(os.listdir(self.user_dir)) == 2

        assert self.get_cdx_len('temp', 'rec') == 3

    def test_dont_record_deleted(self):
        warc_file, warc_size, user_key, curr_size = self._get_info(2)

        self.redis.hset(user_key, 'max_size', 10000)

        old_size = int(self.redis.hget(user_key, 'size'))

        res = self.testapp.delete('/api/v1/recording/rec?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'rec'}

        res = self.testapp.get('/' + self.anon_user + '/temp/rec/record/mp_/http://httpbin.org/get?bood=far2', status=404)

        time.sleep(0.1)

        assert 0 == int(self.redis.hget(user_key, 'size'))

        assert self.get_cdx_len('temp', 'rec') == 0

        def assert_deleted():
            assert not os.path.isfile(warc_file)
            assert len(os.listdir(self.user_dir)) == 0

        self.sleep_try(0.1, 5.0, assert_deleted)

