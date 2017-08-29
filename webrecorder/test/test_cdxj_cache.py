from .testutils import FullStackTests
import time

import gevent
from webrecorder.rec.storagecommitter import StorageCommitter
from webrecorder.rec.worker import Worker


# ============================================================================
class TestCDXJCache(FullStackTests):
    @classmethod
    def setup_class(cls):
        super(TestCDXJCache, cls).setup_class(extra_config_file='test_cdxj_cache_config.yaml')

        cls.worker = Worker(StorageCommitter)
        gevent.spawn(cls.worker.run)

    @classmethod
    def teardown_class(cls):
        cls.worker.stop()
        super(TestCDXJCache, cls).teardown_class()

    def assert_exists(self, key, exists):
        def func():
            assert exists == self.redis.exists(key.format(user=self.anon_user))

        return func

    def test_record_1(self):
        res = self.testapp.get('/' + self.anon_user + '/temp/rec/record/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        time.sleep(0.0)
        assert self.redis.exists('r:{user}:temp:rec:cdxj'.format(user=self.anon_user))

    def test_record_2(self):
        res = self.testapp.get('/' + self.anon_user + '/temp/rec/record/mp_/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        time.sleep(0.0)
        assert len(self.redis.zrange('r:{user}:temp:rec:cdxj'.format(user=self.anon_user), 0, -1)) == 2

    def test_expire_cdxj(self):
        assert self.redis.exists('r:{user}:temp:rec:open'.format(user=self.anon_user))

        time.sleep(1.0)

        assert not self.redis.exists('r:{user}:temp:rec:open'.format(user=self.anon_user))

        self.sleep_try(0.1, 5.0, self.assert_exists('r:{user}:temp:rec:cdxj', False))

    def test_record_2_closed_redir(self):
        res = self.testapp.get('/' + self.anon_user + '/temp/rec/record/mp_/http://httpbin.org/get?food=bar')
        assert res.status_code == 302

    def test_replay_load_cdxj_top_frame(self):
        assert not self.redis.exists('c:{user}:temp:cdxj'.format(user=self.anon_user))

        res = self.testapp.get('/{user}/temp/http://httpbin.org/get?food=bar'.format(user=self.anon_user))

        self.sleep_try(0.1, 0.5, self.assert_exists('c:{user}:temp:cdxj', True))
        assert len(self.redis.zrange('c:{user}:temp:cdxj'.format(user=self.anon_user), 0, -1)) == 2

        self.sleep_try(1.0, 1.0, self.assert_exists('c:{user}:temp:cdxj', False))

    def test_replay_load_cdxj(self):
        assert not self.redis.exists('c:{user}:temp:cdxj'.format(user=self.anon_user))

        res = self.testapp.get('/{user}/temp/mp_/http://httpbin.org/get?food=bar'.format(user=self.anon_user))

        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text
        assert self.redis.exists('c:{user}:temp:cdxj'.format(user=self.anon_user))

        assert len(self.redis.zrange('c:{user}:temp:cdxj'.format(user=self.anon_user), 0, -1)) == 2

