from gevent.monkey import patch_all; patch_all()

from pywb.webagg.test.testutils import FakeRedisTests, BaseTestClass
from pywb.webagg.test.testutils import TempDirTests, to_path

import webtest
import os

from warcio.bufferedreaders import ChunkedDataReader
from io import BytesIO

from fakeredis import FakeStrictRedis
from webrecorder.appcontroller import AppController

from webrecorder.fullstackrunner import FullStackRunner


# ============================================================================
class BaseWRTests(FakeRedisTests, TempDirTests, BaseTestClass):
    @classmethod
    def setup_class(cls, extra_config_file='test_invites_config.yaml', init_anon=True,
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
        cls.set_nx_env('WEBAGG_HOST', 'http://localhost:8010')
        cls.set_nx_env('RECORD_HOST', 'http://localhost:8080')

        cls.set_nx_env('APP_HOST', '')
        cls.set_nx_env('CONTENT_HOST', '')

        cls.set_nx_env('REQUIRE_INVITES', 'true')
        cls.set_nx_env('EMAIL_SENDER', 'test@localhost')
        cls.set_nx_env('EMAIL_SMTP_URL', 'smtp://webrectest@mail.localhost:test@localhost:25')

        cls.redis = FakeStrictRedis.from_url(os.environ['REDIS_BASE_URL'], decode_responses=True)

        cls.custom_init(kwargs)

        if kwargs.get('no_app'):
            return

        cls.appcont = AppController()
        cls.testapp = webtest.TestApp(cls.appcont.app)

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


# ============================================================================
class FullStackTests(BaseWRTests):
    @classmethod
    def custom_init(cls, kwargs):
        env_params = {'TEMP_SLEEP_CHECK': '1',
                      'APP_HOST': '',
                      'CONTENT_HOST': ''}

        cls.runner = FullStackRunner(app_port=-1, env_params=env_params)

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
    def teardown_class(cls, *args, **kwargs):
        cls.runner.close()
        super(FullStackTests, cls).teardown_class(*args, **kwargs)


