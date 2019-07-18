import os
import sys
import base64

from webrecorder.standalone.standalone import StandaloneRunner

from webrecorder.models.usermanager import CLIUserManager
from webrecorder.utils import sanitize_title

from webrecorder.standalone.localredisserver import LocalRedisServer

import redis
from six.moves.urllib.parse import urlsplit


# ============================================================================
class WebrecorderRunner(StandaloneRunner):
    MAIN_REDIS_CONN_NAME = '@wr-runner'

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

        os.environ['REDIS_BROWSER_URL'] = 'redis://localhost:7679/0'
        os.environ['REDIS_SESSION_URL'] = 'redis://localhost:7679/0'
        os.environ['REDIS_BASE_URL'] = 'redis://localhost:7679/1'

        local_info=dict(browser='',
                        reqid='@INIT')

        self.redis_server = LocalRedisServer('redis-server',
                                             port=7679,
                                             redis_dir=self.redis_dir)

        self.browser_redis = self.redis_server.start()

        self.browser_redis.hmset('up:127.0.0.1', local_info)
        self.browser_redis.hset('req:@INIT', 'ip', '127.0.0.1')
        self.browser_redis.client_setname(self.MAIN_REDIS_CONN_NAME)

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

