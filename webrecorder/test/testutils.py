from gevent.monkey import patch_all; patch_all()

from pywb.warcserver.test.testutils import FakeRedisTests, BaseTestClass
from pywb.warcserver.test.testutils import TempDirTests, to_path
from pywb.utils.loaders import load_overlay_config

import webtest
import os
import itertools
import time
import gevent

from warcio.bufferedreaders import ChunkedDataReader
from io import BytesIO

from fakeredis import FakeStrictRedis
from webrecorder.maincontroller import MainController

from webrecorder.fullstackrunner import FullStackRunner

from webrecorder.models import User, Collection, Recording
from webrecorder.models.base import BaseAccess

from webrecorder.rec.tempchecker import TempChecker
from webrecorder.rec.storagecommitter import StorageCommitter
from webrecorder.rec.worker import Worker


# ============================================================================
class BaseWRTests(FakeRedisTests, TempDirTests, BaseTestClass):
    @classmethod
    def setup_class(cls, extra_config_file='test_no_invites_config.yaml',
                    init_anon=True,
                    **kwargs):
        super(BaseWRTests, cls).setup_class()

        cls.warcs_dir = to_path(cls.root_dir + '/warcs/')

        os.makedirs(cls.warcs_dir)
        os.environ['RECORD_ROOT'] = cls.warcs_dir

        os.environ['WR_CONFIG'] = 'pkg://webrecorder/config/wr.yaml'
        if extra_config_file:
            os.environ['WR_USER_CONFIG'] = os.path.join(cls.get_curr_dir(), extra_config_file)

        os.environ['REDIS_BASE_URL'] = 'redis://localhost:6379/2'
        cls.set_nx_env('REDIS_SESSION_URL', 'redis://localhost:6379/0')

        cls.set_nx_env('REDIS_BROWSER_URL', 'redis://localhost:6379/0')
        cls.set_nx_env('WARCSERVER_HOST', 'http://localhost:8010')
        cls.set_nx_env('RECORD_HOST', 'http://localhost:8080')

        cls.set_nx_env('APP_HOST', '')
        cls.set_nx_env('CONTENT_HOST', '')

        cls.set_nx_env('REQUIRE_INVITES', 'true')
        cls.set_nx_env('EMAIL_SENDER', 'test@localhost')
        cls.set_nx_env('EMAIL_SMTP_URL', 'smtp://webrectest@mail.localhost:test@localhost:25')

        def load_wr_config():
            config = load_overlay_config('WR_CONFIG', 'pkg://webrecorder/config/wr.yaml', 'WR_USER_CONFIG', '')
            config['dyn_stats_key_templ'] = {
                 'rec': 'r:{rec}:<sesh_id>:stats:',
                 'coll': 'c:{coll}:<sesh_id>:stats:'
            }

            config['dyn_ref_templ'] = {
                 'rec': 'r:{rec}:<sesh_id>:ref:',
                 'coll': 'c:{coll}:<sesh_id>:ref:',
            }
            return config

        import webrecorder.maincontroller
        webrecorder.maincontroller.load_wr_config = load_wr_config

        cls.redis = FakeStrictRedis.from_url(os.environ['REDIS_BASE_URL'], decode_responses=True)

        cls.custom_init(kwargs)

        if kwargs.get('no_app'):
            return

        cls.maincont = MainController()
        cls.testapp = webtest.TestApp(cls.maincont.app)

        if init_anon:
            res = cls.testapp.get('/api/v1/anon_user')
            cls.anon_user = res.json['anon_user']
        else:
            cls.anon_user = None

    @classmethod
    def custom_init(cls, kwargs):
        pass

    @classmethod
    def set_nx_env(cls, name, value):
        if os.environ.get(name) is None:
            os.environ[name] = value

    @classmethod
    def get_root_dir(cls):
        return os.path.dirname(os.path.dirname(cls.get_curr_dir()))

    @classmethod
    def get_curr_dir(cls):
        return os.path.dirname(os.path.realpath(__file__))

    @classmethod
    def get_coll_rec(cls, user, coll_name, rec_name):
        user = User(my_id=user, redis=cls.redis, access=BaseAccess())
        collection = user.get_collection_by_name(coll_name)
        recording = collection.get_recording_by_name(rec_name) if collection else None

        coll = collection.my_id if collection else None
        rec = recording.my_id if recording else None
        return coll, rec

    @classmethod
    def sleep_try(cls, sleep_interval, max_time, test_func):
        max_count = float(max_time) / sleep_interval
        for counter in itertools.count():
            try:
                time.sleep(sleep_interval)
                test_func()
                return
            except:
                if counter >= max_count:
                    raise


# ============================================================================
class FullStackTests(BaseWRTests):
    runner_env_params = {'TEMP_SLEEP_CHECK': '1',
                         'APP_HOST': '',
                         'CONTENT_HOST': ''}

    @classmethod
    def custom_init(cls, kwargs):
        cls.runner = FullStackRunner(app_port=-1, env_params=cls.runner_env_params)

    @classmethod
    def _get_dechunked(cls, stream):
        buff = ChunkedDataReader(BytesIO(stream))

        warcin = BytesIO()
        while True:
            b = buff.read()
            if not b:
                break
            warcin.write(b)

        warcin.seek(0)
        return warcin

    @classmethod
    def setup_class(cls, *args, **kwargs):
        super(FullStackTests, cls).setup_class(*args, **kwargs)

        storage_worker = kwargs.get('storage_worker')
        temp_worker = kwargs.get('temp_worker')

        cls.storage_worker = Worker(StorageCommitter) if storage_worker else None
        if cls.storage_worker:
            gevent.spawn(cls.storage_worker.run)

        cls.temp_worker = Worker(TempChecker) if temp_worker else None
        if cls.temp_worker:
            gevent.spawn(cls.temp_worker.run)

    @classmethod
    def teardown_class(cls, *args, **kwargs):
        if cls.temp_worker:
            cls.temp_worker.stop()

        if cls.storage_worker:
            cls.storage_worker.stop()

        cls.runner.close()
        super(FullStackTests, cls).teardown_class(*args, **kwargs)




