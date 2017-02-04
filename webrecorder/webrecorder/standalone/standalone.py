from webrecorder.fullstackrunner import FullStackRunner

from webrecorder.admin import main as admin_main
from webrecorder.standalone.assetsutils import patch_bundle

from webrecorder.uploadcontroller import UploadController, InplaceUploader
from webrecorder.rec.webrecrecorder import WebRecRecorder

from argparse import ArgumentParser, RawTextHelpFormatter

from webrecorder.redisman import init_manager_for_cli

from pywb.utils.loaders import LimitReader

import os
import sys
import pkgutil
import logging
import base64

import gevent
import redis

import argparse
import atexit


# ============================================================================
class StandaloneRunner(FullStackRunner):
    def __init__(self, warcs_dir='', redis_db='', debug=False,
                 app_port=8090, rec_port=0, agg_port=0):

        logging.basicConfig(format='%(asctime)s: [%(levelname)s]: %(message)s',
                            level=logging.DEBUG if debug else logging.INFO)

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

        patch_bundle()

        self._patch_redis(redis_db)

        self.admin_init()

        super(StandaloneRunner, self).__init__(app_port=app_port,
                                               rec_port=rec_port,
                                               agg_port=agg_port)
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

    def close(self):
        super(StandaloneRunner, self).close()

    @classmethod
    def main(cls, args=None):
        parser = ArgumentParser(formatter_class=RawTextHelpFormatter)

        parser.add_argument('--no-browser', action='store_true',
                            default=False,
                            help="Don't launch browser automatically")

        parser.add_argument('-p', '--port', type=int,
                            default=8090,
                            help="Port to run the application")

        parser.add_argument('--debug', action='store_true',
                            help='Enable debug logging')

        cls.add_args(parser)
        r = parser.parse_args(args=args)
        main = cls(r)

        main.app_serv.ge.join()


# ============================================================================
class WebrecorderRunner(StandaloneRunner):
    def __init__(self, argres):
        super(WebrecorderRunner, self).__init__(warcs_dir=argres.warcs_dir,
                                                redis_db=argres.db,
                                                app_port=argres.port,
                                                debug=argres.debug)
        if not argres.no_browser:
            import webbrowser
            webbrowser.open_new(os.environ['APP_HOST'] + '/')

  #  def _patch_redis(self, redis_db):
  #      from webrecorder.standalone.hiconn import patch_from_url
  #      patch_from_url(redis_db)

    def init_env(self):
        super(WebrecorderRunner, self).init_env()
        os.environ['WR_USER_CONFIG'] = 'pkg://webrecorder/config/standalone_recorder.yaml'

    @classmethod
    def add_args(cls, parser):
        parser.add_argument('-w', '--warcs-dir',
                            default='./data/warcs/',
                            help='WARC Output Root Dir')

        parser.add_argument('--db',
                            default='./data/wr.rld',
                            help='WR Database file')


# ============================================================================
class WebrecPlayerRunner(StandaloneRunner):
    ARCHIVE_EXT = ('.warc', '.arc', '.warc.gz', '.arc.gz', '.warcgz', '.arcgz')

    def __init__(self, argres):
        super(WebrecPlayerRunner, self).__init__(app_port=argres.port,
                                                 rec_port=-1,
                                                 debug=argres.debug)

        if not argres.no_browser:
            import webbrowser
            webbrowser.open_new(os.environ['APP_HOST'] + '/')

        gevent.spawn(self.auto_load_warcs, argres)

    def auto_load_warcs(self, argres):
        manager = init_manager_for_cli()

        indexer = WebRecRecorder.make_wr_indexer(manager.config)

        uploader = InplaceUploader(manager, indexer, '@INIT')

        files = list(self.get_archive_files(argres.inputs))

        uploader.multifile_upload('local', files)

    def init_env(self):
        super(WebrecPlayerRunner, self).init_env()
        os.environ['WR_USER_CONFIG'] = 'pkg://webrecorder/config/standalone_player.yaml'
        os.environ['SECRET_KEY'] = base64.b32encode(os.urandom(75)).decode('utf-8')

    def get_archive_files(self, inputs, prefix=''):
        for filename in inputs:
            if prefix:
                filename = os.path.join(prefix, filename)

            if os.path.isfile(filename) and filename.endswith(self.ARCHIVE_EXT):
                yield filename

            if os.path.isdir(filename):
                for root, dirs, files in os.walk(filename):
                    for filename_ in self.get_archive_files(files, root):
                        yield filename_

    @classmethod
    def add_args(cls, parser):
        parser.add_argument('inputs', nargs='+')


# ============================================================================
# cli scripts
webrecorder = WebrecorderRunner.main
webrecorder_player = WebrecPlayerRunner.main


# ============================================================================
if __name__ == "__main__":
    webrecorder_player()

