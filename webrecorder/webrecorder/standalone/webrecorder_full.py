import os
import sys
import base64
import shutil

from webrecorder.standalone.standalone import StandaloneRunner

from webrecorder.models.usermanager import CLIUserManager
from webrecorder.utils import sanitize_title

from webrecorder.standalone.localredisserver import LocalRedisServer

import redis
from six.moves.urllib.parse import urlsplit


# ============================================================================
class WebrecorderRunner(StandaloneRunner):
    REDIS_PORT = 7679

    def __init__(self, argres):
        self.root_dir = argres.root_dir
        self.redis_dir = os.path.join(self.root_dir, 'redis')

        self.user_manager = None

        self.browser_redis = None

        self.default_user = argres.default_user

        super(WebrecorderRunner, self).__init__(argres, rec_port=0)

        if not argres.no_browser:
            import webbrowser
            webbrowser.open_new(os.environ['APP_HOST'] + '/')

    def _runner_init(self):
        os.environ['WR_USER_CONFIG'] = 'pkg://webrecorder/config/standalone_recorder.yaml'
        os.environ['SECRET_KEY'] = base64.b32encode(os.urandom(75)).decode('utf-8')

        os.environ['RECORD_ROOT'] = os.path.join(self.root_dir, 'warcs', '')
        os.environ['STORAGE_ROOT'] = os.path.join(self.root_dir, 'storage', '')

        os.environ['REDIS_BROWSER_URL'] = 'redis://localhost:{0}/0'.format(self.REDIS_PORT)
        os.environ['REDIS_SESSION_URL'] = 'redis://localhost:{0}/0'.format(self.REDIS_PORT)
        os.environ['REDIS_BASE_URL'] = 'redis://localhost:{0}/1'.format(self.REDIS_PORT)

        os.environ['ALLOW_DAT'] = '1'
        os.environ['DAT_SHARE_HOST'] = 'localhost'

        local_info=dict(browser='',
                        reqid='@INIT')

        self.redis_server = LocalRedisServer(port=self.REDIS_PORT,
                                             redis_dir=self.redis_dir)

        self.browser_redis = self.redis_server.start()

        self.browser_redis.hmset('up:127.0.0.1', local_info)
        self.browser_redis.hset('req:@INIT', 'ip', '127.0.0.1')

        self.user_manager = CLIUserManager()

        if not self.default_user:
            return

        if not self.user_manager.USER_RX.match(self.default_user):
            self.default_user = sanitize_title(self.default_user)

        if not self.user_manager.check_user(self.default_user):
            res = self.user_manager.create_user(
              email='{0}@localhost'.format(self.default_user),
              username=self.default_user,
              passwd='LocalUser1',
              role='admin',
              name=self.default_user)

        # set max_size to available free space, if possible
        try:
            res = shutil.disk_usage(self.root_dir)
            max_size = res[2]
            user = self.user_manager.all_users[self.default_user]
            user.set_prop('max_size', max_size)
        except Exception as e:
            print(e)

        os.environ['AUTO_LOGIN_USER'] = self.default_user

    def close(self):
        super(WebrecorderRunner, self).close()


    @classmethod
    def add_args(cls, parser):
        parser.add_argument('-d', '--root-dir',
                            default='./data/',
                            help='Root Data Dir')

        parser.add_argument('-u', '--default-user',
                            default=None,
                            help='Create & Auto-Login as Default User')


# ============================================================================
webrecorder = WebrecorderRunner.main


if __name__ == "__main__":
    webrecorder()

