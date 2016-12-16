from webrecorder.fullstackrunner import FullStackRunner
from fakeredis import FakeStrictRedis

from webrecorder.admin import main as admin_main

from webassets import Bundle
from webassets.ext.jinja2 import AssetsExtension

import os
import sys

import redis
import fakeredis

import webbrowser


# ==================================================================
class StandaloneRunner(FullStackRunner):
    def __init__(self):
        if getattr(sys, 'frozen', False):
            self.app_dir = sys._MEIPASS
        else:
            self.app_dir = os.path.dirname(os.path.abspath(__file__))

        os.environ['WRROOT'] = self.app_dir
        print('WRROOT:', os.environ['WRROOT'])

        self.init_mock_redis()
        self.init_env()

        os.environ['RECORD_ROOT'] = os.path.join(os.path.dirname(sys.executable), os.environ['RECORD_ROOT'])

        self.admin_init()

        super(StandaloneRunner, self).__init__()

        webbrowser.open_new('http://localhost:8090/')

    def init_mock_redis(self):
        redis.StrictRedis = fakeredis.FakeStrictRedis

    def admin_init(self):
        admin_main(['-c', 'test@localhost', 'local', 'LocalUser1', 'archivist', 'local'])
        os.environ['AUTO_LOGIN_USER'] = 'local'

    def init_env(self):
        env_file = os.path.join(self.app_dir, 'config', 'wr_local.env')
        with open(env_file) as fh:
            for line in fh:
                line = line.rstrip()
                if not line or '#' in line:
                    continue

                parts = line.split('=')
                if len(parts) == 2:
                    os.environ[parts[0]] = os.path.expandvars(parts[1])

    def close(self):
        super(StandaloneRunner, self).close()


# ==================================================================
class FixedBundle(Bundle):
    def __init__(self, *a, **kw):
        super(FixedBundle, self).__init__(*a, **kw)
        self.output_file = a[0].output

    def urls(self, *a, **kw):
        return ['/static/__shared/' + self.output_file]

    def _set_filters(self, value):
        self._filters = ()


AssetsExtension.BundleClass = FixedBundle


# ==================================================================
if __name__ == "__main__":
    main = StandaloneRunner()
    main.app_serv.ge.join()

