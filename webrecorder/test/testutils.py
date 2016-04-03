from webagg.test.testutils import FakeRedisTests, BaseTestClass
from webagg.test.testutils import TempDirTests, to_path

import webtest
import os

from fakeredis import FakeStrictRedis
from webrecorder.appcontroller import AppController


# ============================================================================
class BaseWRTests(FakeRedisTests, TempDirTests, BaseTestClass):
    @classmethod
    def setup_class(cls):
        super(BaseWRTests, cls).setup_class()

        cls.warcs_dir = to_path(cls.root_dir + '/warcs/')
        os.makedirs(cls.warcs_dir)
        os.environ['RECORD_ROOT'] = cls.warcs_dir

        os.environ['WR_CONFIG'] = os.path.join(cls.get_root_dir(), 'wr.yaml')

        cls.appcont = AppController(configfile=os.path.join(cls.get_curr_dir(), 'test_config.yaml'))
        cls.testapp = webtest.TestApp(cls.appcont.app)
        cls.redis = FakeStrictRedis.from_url(os.environ['REDIS_BASE_URL'])

    def get_anon_user(self):
        anon_user = 'anon/' + self.testapp.cookies['__test_sesh'][-32:]
        return anon_user

    @classmethod
    def get_root_dir(cls):
        return os.path.dirname(os.path.dirname(cls.get_curr_dir()))

    @classmethod
    def get_curr_dir(cls):
        return os.path.dirname(os.path.realpath(__file__))


