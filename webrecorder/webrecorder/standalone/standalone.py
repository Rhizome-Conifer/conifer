from webrecorder.fullstackrunner import FullStackRunner
from fakeredis import FakeStrictRedis

from webrecorder.admin import main as admin_main
from webrecorder.standalone.assetsutils import patch_bundle

import os
import sys
import pkgutil

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

        self.admin_init()

        super(StandaloneRunner, self).__init__()

        webbrowser.open_new('http://localhost:8090/')

    def init_mock_redis(self):
        redis.StrictRedis = fakeredis.FakeStrictRedis

    def admin_init(self):
        admin_main(['-c', 'test@localhost', 'local', 'LocalUser1', 'archivist', 'local'])
        os.environ['AUTO_LOGIN_USER'] = 'local'

    def init_env(self):
        fh = pkgutil.get_data('webrecorder', 'config/wr_sample.env')
        for line in fh.decode('utf-8').split('\n'):
            line = line.rstrip()
            if not line or '#' in line:
                continue

            parts = line.split('=')
            if len(parts) == 2:
                os.environ[parts[0]] = os.path.expandvars(parts[1])


        os.environ['RECORD_ROOT'] = os.path.join(os.path.dirname(sys.executable),
                                                 './' + os.environ['RECORD_ROOT'])

        os.environ['WR_CONFIG'] = 'pkg://webrecorder/config/wr.yaml'
        os.environ['WR_USER_CONFIG'] = 'pkg://webrecorder/config/player_config.yaml'

        os.environ['REDIS_BASE_URL'] = 'redis://localhost/1'
        os.environ['REDIS_SESSION_URL'] = 'redis://localhost/0'
        os.environ['REDIS_BROWSER_URL'] = 'redis://localhost/0'

        if getattr(sys, 'frozen', False):
            os.environ['WR_TEMPLATE_PKG'] = 'wrtemp'

    def close(self):
        super(StandaloneRunner, self).close()


# ==================================================================
def main():
    patch_bundle()
    main = StandaloneRunner()
    main.app_serv.ge.join()


# ==================================================================
if __name__ == "__main__":
    main()
