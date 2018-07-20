import os
import sys
import base64

from webrecorder.standalone.standalone import StandaloneRunner

from webrecorder.models.usermanager import CLIUserManager
from webrecorder.utils import sanitize_title

import redis
import redislite.client
from six.moves.urllib.parse import urlsplit


# ============================================================================
class WebrecorderRunner(StandaloneRunner):
    MAIN_REDIS_CONN_NAME = '@wr-runner'

    def __init__(self, argres):
        self.root_dir = argres.root_dir
        self.redis_dir = os.path.join(self.root_dir, 'redis', 'redis.db')

        self.user_manager = None

        self.browser_redis = None

        self.default_user = argres.default_user

        os.makedirs(os.path.dirname(self.redis_dir), exist_ok=True)

        super(WebrecorderRunner, self).__init__(argres, rec_port=0)

        if not argres.no_browser:
            import webbrowser
            webbrowser.open_new(os.environ['APP_HOST'] + '/')

    def _init_redislite(self):
        import redislite
        if getattr(sys, 'frozen', False):
            redislite.__redis_executable__ = os.path.join(os.path.dirname(sys.argv[0]), 'redis-server')
            redislite.client.__redis_executable__ = redislite.__redis_executable__

        print('Redis Server: ' + redislite.client.__redis_executable__)

        redis.StrictRedis = FixedStrictRedis
        FixedStrictRedis.WR_REDIS_DB = self.redis_dir

    def _init_fakeredis(self):
        import redis
        import fakeredis
        redis.StrictRedis = fakeredis.FakeStrictRedis

    def _runner_init(self):
        os.environ['WR_USER_CONFIG'] = 'pkg://webrecorder/config/standalone_recorder.yaml'
        os.environ['SECRET_KEY'] = base64.b32encode(os.urandom(75)).decode('utf-8')

        os.environ['RECORD_ROOT'] = os.path.join(self.root_dir, 'warcs', '')
        os.environ['STORAGE_ROOT'] = os.path.join(self.root_dir, 'storage', '')

        self._init_redislite()
        #self._init_fakeredis()

        local_info=dict(browser='',
                        reqid='@INIT')

        self.browser_redis = redis.StrictRedis.from_url(os.environ['REDIS_BROWSER_URL'])
        self.browser_redis.hmset('ip:127.0.0.1', local_info)
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
              role='archivist',
              name=self.default_user)

        os.environ['AUTO_LOGIN_USER'] = self.default_user

    def close(self):
        super(WebrecorderRunner, self).close()

        num_runners = 0
        clients = self.browser_redis.client_list()
        for client in clients:
            if client.get('name') == self.MAIN_REDIS_CONN_NAME:
                num_runners += 1

        print('Total Conn: {0}'.format(len(clients)))
        print('Total Unique Procs: {0}'.format(num_runners))
        if num_runners == 1:
            print('Last WR Process, Shutting Down Redis')
            self.browser_redis.shutdown()


    @classmethod
    def add_args(cls, parser):
        parser.add_argument('-d', '--root-dir',
                            default='./data/',
                            help='Root Data Dir')

        parser.add_argument('-u', '--default-user',
                            default=None,
                            help='Create & Auto-Login as Default User')


# ============================================================================
class FixedStrictRedis(redislite.client.StrictRedis):
    WR_REDIS_DB = ''

    #def __init__(self, *args, **kwargs):
    #    super(FixedStrictRedis, self).__init__(self.WR_REDIS_DB, **kwargs)

    @classmethod
    def from_url(cls, url, **kwargs):
        """
        Override to only use the db, don't care about other settings when using redislite
        """
        parts = urlsplit(url)
        return cls(cls.WR_REDIS_DB, db=int(parts.path[1:]), **kwargs)


# ============================================================================
webrecorder = WebrecorderRunner.main


if __name__ == "__main__":
    webrecorder()

