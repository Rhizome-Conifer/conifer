from gevent.monkey import patch_all; patch_all()

from pywb.warcserver.test.testutils import FakeRedisTests, BaseTestClass
from pywb.warcserver.test.testutils import TempDirTests, to_path, HttpBinLiveTests
from pywb.utils.loaders import load_overlay_config

import webtest
import os
import itertools
import time
import gevent
import re

from mock import patch

from warcio.bufferedreaders import ChunkedDataReader
from io import BytesIO

from fakeredis import FakeStrictRedis
from webrecorder.maincontroller import MainController

from webrecorder.fullstackrunner import FullStackRunner

from webrecorder.models import User, Collection, Recording
from webrecorder.models.base import BaseAccess, RedisUniqueComponent

from webrecorder.utils import today_str, get_new_id


# ============================================================================
class BaseWRTests(FakeRedisTests, TempDirTests, BaseTestClass):
    ISO_DT_RX = re.compile(r'\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d')


    @classmethod
    def setup_class(cls, extra_config_file='test_no_invites_config.yaml',
                    init_anon=True,
                    **kwargs):
        super(BaseWRTests, cls).setup_class()

        cls.warcs_dir = to_path(cls.root_dir + '/warcs/')
        cls.storage_dir = os.path.join(to_path(cls.root_dir + '/storage/'))

        os.makedirs(cls.warcs_dir)
        os.environ['RECORD_ROOT'] = cls.warcs_dir
        os.environ['STORAGE_ROOT'] = cls.storage_dir

        cls.storage_today = os.path.join(cls.storage_dir, today_str())

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

        cls.set_nx_env('NO_REMOTE_BROWSERS', '1')

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
        cls.sesh_redis = FakeStrictRedis.from_url(os.environ['REDIS_SESSION_URL'], decode_responses=True)

        cls.custom_init(kwargs)

        if kwargs.get('no_app'):
            return

        cls.maincont = MainController()
        cls.testapp = webtest.TestApp(cls.maincont.app)

        if init_anon:
            res = cls.testapp.post('/api/v1/auth/anon_user')
            cls.anon_user = res.json['user']['username']
            cls.assert_temp_user_sesh(cls.anon_user)
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
    def assert_temp_user_sesh(cls, anon_user):
        sesh = cls.sesh_redis.get('t:{0}'.format(anon_user))
        assert sesh
        # ensure session key exists and is expiring
        assert cls.sesh_redis.ttl('sesh:{0}'.format(sesh)) > 0

    @classmethod
    def get_coll_rec(cls, user, coll_name, rec):
        user = User(my_id=user, redis=cls.redis, access=BaseAccess())
        collection = user.get_collection_by_name(coll_name)
        recording = collection.get_recording(rec) if collection else None

        coll = collection.my_id if collection else None
        rec = recording.my_id if recording else None
        return coll, rec

    @classmethod
    def get_coll_rec_obj(cls, coll_name, rec):
        user = User(my_id=cls.anon_user, redis=cls.redis, access=BaseAccess())
        collection = user.get_collection_by_name(coll_name)
        recording = collection.get_recording(rec) if collection else None
        return collection, recording

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
class FullStackTests(HttpBinLiveTests, BaseWRTests):
    runner_env_params = {'TEMP_SLEEP_CHECK': '1',
                         'APP_HOST': '',
                         'CONTENT_HOST': ''}

    rec_ids = []

    @classmethod
    def set_uuids(cls, name, id_list):
        cls.ids_map[name] = iter(id_list)

    @classmethod
    def new_id_override(cls):
        cls.ids_map = {'Recording': [],
                       'Collection': [],
                       'BookmarkList': []
                      }

        def get_new_id_o(self, max_len=None):
            try:
                id_gen = cls.ids_map.get(self.__class__.__name__)
                return str(next(id_gen))
            except:
                return get_new_id(max_len)

        return get_new_id_o

    @classmethod
    def add_rec_id(cls, id_):
        cls.rec_ids.append(id_)

    def get_new(self, url, *args, **kwargs):
        res = self.testapp.get(url, *args, **kwargs)
        assert res.status_code == 302
        rec_id = res.location.split('/', 7)[5]
        self.add_rec_id(rec_id)
        return res

    @classmethod
    def _anon_post(self, url, *args, **kwargs):
        return self.testapp.post_json(self._format_url(url), *args, **kwargs)

    @classmethod
    def _anon_delete(self, url, *args, **kwargs):
        return self.testapp.delete_json(self._format_url(url), *args, **kwargs)

    @classmethod
    def _anon_get(self, url, *args, **kwargs):
        return self.testapp.get(self._format_url(url), *args, **kwargs)

    @classmethod
    def _list_get(self, index):
        try:
            return self.rec_ids[index]
        except:
            return ''

    @classmethod
    def assert_coll_rec_warcs(cls, coll, rec, num_coll, num_rec):
        assert cls.redis.hlen(Recording.COLL_WARC_KEY.format(coll=coll)) == num_coll
        assert cls.redis.scard(Recording.REC_WARC_KEY.format(rec=rec)) == num_rec

    @classmethod
    def _format_url(self, url):
        return url.format(user=self.anon_user,
                          rec_id_0=self._list_get(0),
                          rec_id_1=self._list_get(1),
                          rec_id_2=self._list_get(2),
                          rec_id_3=self._list_get(3)
                         )

    @classmethod
    def custom_init(cls, kwargs):
        cls.runner = FullStackRunner(app_port=-1, env_params=cls.runner_env_params,
                                     run_tempchecker=kwargs.get('temp_worker'),
                                     run_storagecommitter=kwargs.get('storage_worker'))

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

        cls.id_mock = patch('webrecorder.models.base.RedisUniqueComponent.get_new_id', cls.new_id_override())
        cls.id_mock.start()

    @classmethod
    def teardown_class(cls, *args, **kwargs):
        cls.id_mock.stop()

        cls.runner.close()
        super(FullStackTests, cls).teardown_class(*args, **kwargs)




