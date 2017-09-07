from .testutils import FullStackTests
import time
import os

import gevent
from webrecorder.rec.storagecommitter import StorageCommitter
from webrecorder.rec.worker import Worker
from webrecorder.redisman import init_manager_for_cli
from pywb.utils.loaders import load as load_test

from mock import patch

load_counter = 0

# ============================================================================
def slow_load(self, *args, **kwargs):
    time.sleep(0.4)
    global load_counter
    load_counter += 1
    return load_test(*args, **kwargs)


# ============================================================================
class TestCDXJCache(FullStackTests):
    @classmethod
    def setup_class(cls):
        super(TestCDXJCache, cls).setup_class(extra_config_file='test_cdxj_cache_config.yaml')

        cls.worker = Worker(StorageCommitter)
        gevent.spawn(cls.worker.run)

        cls.m = init_manager_for_cli()

    @classmethod
    def teardown_class(cls):
        cls.worker.stop()
        super(TestCDXJCache, cls).teardown_class()

    def assert_exists(self, key, exists):
        def func():
            assert exists == self.redis.exists(key.format(user=self.anon_user))

        return func

    def test_record_1(self):
        res = self.testapp.get('/_new/temp/rec/record/mp_/http://httpbin.org/get?food=bar')
        assert res.status_code == 302
        res = res.follow()
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        self.sleep_try(0.1, 1.0, self.assert_exists('r:{user}:temp:rec:cdxj', True))

    def test_record_2(self):
        res = self.testapp.get('/' + self.anon_user + '/temp/rec/record/mp_/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        def assert_cdx():
            assert len(self.redis.zrange('r:{user}:temp:rec:cdxj'.format(user=self.anon_user), 0, -1)) == 2

        self.sleep_try(0.1, 2.0, assert_cdx)

    def test_expire_cdxj(self):
        assert self.redis.exists('r:{user}:temp:rec:open'.format(user=self.anon_user))

        assert len(self.runner.rec_serv.server.application.wr.writer.fh_cache) == 1

        self.sleep_try(0.5, 5.0, self.assert_exists('r:{user}:temp:rec:open', False))

        self.sleep_try(0.1, 5.0, self.assert_exists('r:{user}:temp:rec:cdxj', False))

        def assert_files_closed():
            assert len(self.runner.rec_serv.server.application.wr.writer.fh_cache) == 0

        self.sleep_try(0.1, 3.0, assert_files_closed)

    def test_record_2_closed_not_found(self):
        res = self.testapp.get('/' + self.anon_user + '/temp/rec/record/mp_/http://httpbin.org/get?food=bar', status=404)

    def test_replay_load_cdxj(self):
        assert not self.redis.exists('c:{user}:temp:cdxj'.format(user=self.anon_user))

        res = self.testapp.get('/{user}/temp/mp_/http://httpbin.org/get?food=bar'.format(user=self.anon_user))

        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text
        self.sleep_try(0.1, 0.5, self.assert_exists('c:{user}:temp:cdxj', True))

        assert len(self.redis.zrange('c:{user}:temp:cdxj'.format(user=self.anon_user), 0, -1)) == 2
        self.sleep_try(1.0, 1.0, self.assert_exists('c:{user}:temp:cdxj', False))

    @patch('webrecorder.redisman.load', slow_load)
    def test_sync_avoid_double_load(self):
        self.assert_exists('c:{user}:temp:cdxj', False)()
        self.assert_exists('r:{user}:temp:rec:cdxj', False)()

        self.m.sync_coll_index(self.anon_user, 'temp', exists=False, do_async=True)

        time.sleep(0.1)

        self.assert_exists('r:{user}:temp:rec:cdxj:_', True)()

        self.m.sync_coll_index(self.anon_user, 'temp', exists=True, do_async=True)

        time.sleep(0.1)

        self.assert_exists('r:{user}:temp:rec:cdxj:_', True)()

        self.sleep_try(0.1, 0.5, self.assert_exists('r:{user}:temp:rec:cdxj:_', False))

        assert load_counter == 1

    def test_ensure_all_files_delete(self):
        user_dir = os.path.join(self.warcs_dir, self.anon_user)
        files = os.listdir(user_dir)
        assert len(files) == 2

        # verify .cdxj is written
        assert ((files[0].endswith('.cdxj') and files[1].endswith('.warc.gz')) or
                (files[1].endswith('.cdxj') and files[0].endswith('.warc.gz')))

        res = self.testapp.delete('/api/v1/recordings/rec?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'rec'}

        def assert_deleted():
            assert len(os.listdir(user_dir)) == 0

        self.sleep_try(0.1, 10.0, assert_deleted)


