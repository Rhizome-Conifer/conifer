from webrecorder.fullstackrunner import FullStackRunner

from webrecorder.admin import main as admin_main
from webrecorder.standalone.versionbuild import get_full_version

from argparse import ArgumentParser, RawTextHelpFormatter

import os
import sys
import pkgutil
import logging

import redis

import argparse
import atexit


# ============================================================================
class StandaloneRunner(FullStackRunner):
    def __init__(self, warcs_dir='', redis_db='', loglevel=None,
                 app_port=8090, rec_port=0, warc_port=0):

        if isinstance(loglevel, str):
            try:
                loglevel = getattr(logging, loglevel.upper())
            except:
                loglevel = None

        loglevel = loglevel or logging.INFO

        logging.basicConfig(format='%(asctime)s: [%(levelname)s]: %(message)s',
                            level=loglevel)

        if getattr(sys, 'frozen', False):
            self.app_dir = sys._MEIPASS
            if not os.getcwd():
                os.setcwd(self.app_dir)
        else:
            self.app_dir = os.getcwd()

        if redis_db:
            try:
                os.makedirs(os.path.dirname(redis_db))
            except OSError:
                pass

        self.warcs_dir = warcs_dir
        self.init_env()

        self._patch_redis(redis_db)

        self.admin_init()

        from webrecorder.standalone.assetsutils import patch_bundle
        patch_bundle()

        super(StandaloneRunner, self).__init__(app_port=app_port,
                                               rec_port=rec_port,
                                               warc_port=warc_port)
        atexit.register(self.close)

    def _patch_redis(self, redis_db):
        import fakeredis
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


        os.environ['RECORD_ROOT'] = self.warcs_dir

        os.environ['WR_CONFIG'] = 'pkg://webrecorder/config/wr.yaml'

        os.environ['REDIS_BASE_URL'] = 'redis://localhost/1'
        os.environ['REDIS_SESSION_URL'] = 'redis://localhost/0'
        os.environ['REDIS_BROWSER_URL'] = 'redis://localhost/0'

        os.environ['NO_REMOTE_BROWSERS'] = 'true'

        if getattr(sys, 'frozen', False):
            os.environ['WR_TEMPLATE_PKG'] = 'wrtemp'

    @classmethod
    def main(cls, args=None, embed=False):
        parser = ArgumentParser(formatter_class=RawTextHelpFormatter)

        parser.add_argument('--no-browser', action='store_true',
                            default=False,
                            help="Don't launch browser automatically")

        parser.add_argument('-p', '--port', type=int,
                            default=8090,
                            help="Port to run the application")

        parser.add_argument('--loglevel',
                            help='Set logging level')

        parser.add_argument('-v', '--version', action='version',
                            version=get_full_version(),
                            help='Print version and quit')

        cls.add_args(parser)
        r = parser.parse_args(args=args)

        main = cls(r)

        if embed:
            return main

        main.app_serv.ge.join()
