from webrecorder.fullstackrunner import FullStackRunner

from webrecorder.admin import main as admin_main
from webrecorder.standalone.assetsutils import patch_bundle

from webrecorder.uploadcontroller import UploadController
from webrecorder.rec.webrecrecorder import WebRecRecorder

from argparse import ArgumentParser, RawTextHelpFormatter

from webrecorder.redisman import init_manager_for_cli

import os
import sys
import pkgutil
import logging

import redis
#import redislite.patch
#import hirlite
#from hiconn import patch_from_url

import webbrowser
import argparse
import atexit


# ============================================================================
class StandaloneRunner(FullStackRunner):
    def __init__(self, warcs_dir='', redis_db='', app_port=8090, rec_port=0, agg_port=0):
        logging.basicConfig(format='%(asctime)s: [%(levelname)s]: %(message)s',
                            level=logging.INFO)

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

        self.init_env(warcs_dir)

        patch_bundle()

        self._patch_redis(redis_db)

        self.admin_init()

        super(StandaloneRunner, self).__init__(local_only=True,
                                               app_port=app_port,
                                               rec_port=rec_port,
                                               agg_port=agg_port)
        atexit.register(self.close)

    def _patch_redis(self, redis_db):
        pass

    def admin_init(self):
        admin_main(['-c', 'test@localhost', 'local', 'LocalUser1', 'archivist', 'local'])
        os.environ['AUTO_LOGIN_USER'] = 'local'

    def init_env(self, warcs_dir):
        fh = pkgutil.get_data('webrecorder', 'config/wr_sample.env')
        for line in fh.decode('utf-8').split('\n'):
            line = line.rstrip()
            if not line or '#' in line:
                continue

            parts = line.split('=')
            if len(parts) == 2:
                os.environ[parts[0]] = os.path.expandvars(parts[1])


        os.environ['RECORD_ROOT'] = warcs_dir

        os.environ['WR_CONFIG'] = 'pkg://webrecorder/config/wr.yaml'
        os.environ['WR_USER_CONFIG'] = 'pkg://webrecorder/config/player_config.yaml'

        os.environ['REDIS_BASE_URL'] = 'redis://localhost/1'
        os.environ['REDIS_SESSION_URL'] = 'redis://localhost/0'
        os.environ['REDIS_BROWSER_URL'] = 'redis://localhost/0'

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

        cls.add_args(parser)
        r = parser.parse_args(args=args)
        main = cls(r)

        main.app_serv.ge.join()


# ============================================================================
class WebrecorderRunner(StandaloneRunner):
    def __init__(self, argres):
        super(WebrecorderRunner, self).__init__(argres.warcs_dir, argres.db)
        if argres.no_browser:
            webbrowser.open_new('http://localhost:8090/')

    def _patch_redis(self, redis_db):
        from webrecorder.standalone.hiconn import patch_from_url
        patch_from_url(redis_db)

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
        super(WebrecPlayerRunner, self).__init__(rec_port=-1)

        manager = init_manager_for_cli()

        indexer = WebRecRecorder.make_wr_indexer(manager.config)

        uploader = InplaceUploader(manager, indexer)

        for filename in self.get_archive_files(argres.inputs):
            with open(filename, 'rb') as stream:
                uploader.handle_upload(stream, filename, 'local', False)

        if not argres.no_browser:
            webbrowser.open_new('http://localhost:8090/local/')

    def _patch_redis(self, redis_db):
        import redis
        import fakeredis
        redis.StrictRedis = fakeredis.FakeStrictRedis

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
class InplaceUploader(UploadController):
    def __init__(self, manager, indexer):
        super(InplaceUploader, self).__init__(None, None, manager, manager.config)
        self.indexer = indexer

    def init_routes(self):
        pass

    def do_upload(self, filename, stream, user, coll, rec, offset, length):
        stream.seek(offset)

        params = {'param.user': user,
                  'param.coll': coll,
                  'param.rec': rec
                 }

        self.indexer.add_warc_file(filename, params)
        self.indexer.add_urls_to_index(stream, params, filename, length)

    def _get_existing_coll(self, user, info):
        # if enabled, force all 'Temporary Collection' into one collection?
        return None

        if info.get('title') != 'Temporary Collection':
            return None

        collection = self.manager.get_collection(user, 'webrecorder-collection')
        if collection:
            return collection

        desc = ''
        collection = {'type': 'collection',
                      'title': 'Webrecorder Collection',
                      'desc': desc,
                     }

        collection['id'] = self.sanitize_title(collection['title'])
        actual_collection = self.manager.create_collection(user,
                                       collection['id'],
                                       collection['title'],
                                       collection.get('desc', ''),
                                       collection.get('public', False))

        collection['id'] = actual_collection['id']
        collection['title'] = actual_collection['title']

        return collection


# ============================================================================
# cli scripts
webrecorder = WebrecorderRunner.main
webrecorder_player = WebrecPlayerRunner.main


# ============================================================================
if __name__ == "__main__":
    webrecorder_player()

