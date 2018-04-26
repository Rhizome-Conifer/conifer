import gevent
import base64
import os

from webrecorder.standalone.standalone import StandaloneRunner
from webrecorder.rec.webrecrecorder import WebRecRecorder

from webrecorder.models.importer import InplaceImporter, ImportStatusChecker
from webrecorder.models.usermanager import CLIUserManager
from webrecorder.models.collection import Collection

from webrecorder.standalone.serializefakeredis import FakeRedisSerializer

from gevent.threadpool import ThreadPool

import traceback
import redis
import fakeredis
import logging


# ============================================================================
class WebrecPlayerRunner(StandaloneRunner):
    ARCHIVE_EXT = ('.warc', '.arc', '.warc.gz', '.arc.gz', '.warcgz', '.arcgz', '.har')

    def __init__(self, argres):
        self.inputs = argres.inputs
        self.serializer = None

        super(WebrecPlayerRunner, self).__init__(argres)

        if not argres.no_browser:
            import webbrowser
            webbrowser.open_new(os.environ['APP_HOST'] + '/')

    def close(self):
        super(WebrecPlayerRunner, self).close()

    def _patch_redis(self, cache_dir):
        redis.StrictRedis = fakeredis.FakeStrictRedis
        if not cache_dir:
            return

        cache_dir = os.path.join(os.path.dirname(self.inputs[0]), cache_dir)
        try:
            os.makedirs(cache_dir)
        except OSError:
            pass

        name = os.path.basename(self.inputs[0]).replace('.warc.gz', '-cache.json.gz')
        cache_db = os.path.join(cache_dir, name)

        self.serializer = FakeRedisSerializer(cache_db, self.inputs)

    def admin_init(self):
        if self.load_cache():
            return

        pool = ThreadPool(maxsize=1)
        pool.spawn(self.safe_auto_load_warcs)

    def load_cache(self):
        if not self.serializer:
            logging.debug('No Serializer, indexing')
            return False

        if self.serializer.load_db():
            logging.debug('Index Loaded from Cache, Skipping')
            return True
        else:
            logging.debug('Index Not Loaded from cache, reindexing')
            return False

    def save_cache(self):
        if not self.serializer:
            return

        try:
            user_manager = CLIUserManager()

            user = user_manager.all_users['local']

            status_checker = ImportStatusChecker(user_manager.redis)

            upload_status = status_checker.get_upload_status(user, '@INIT')

            collection = user.get_collection_by_name('collection')

            if not upload_status or upload_status.get('done'):
                if collection and user_manager.redis.exists(Collection.COLL_CDXJ_KEY.format(coll=collection.my_id)):
                    self.serializer.save_db()
        except Exception as e:
            if logging.getLogger().getEffectiveLevel() == logging.DEBUG:
                traceback.print_exc()

            logging.debug('Error Closing, Not Saved: ' + str(e))

    def safe_auto_load_warcs(self):
        try:
            self.auto_load_warcs()
        except:
            print('Initial Load Failed!')
            traceback.print_exc()

    def auto_load_warcs(self):
        manager = CLIUserManager()
        user, _ = manager.create_user(
                    email='test@localhost',
                    username='local',
                    passwd='LocalUser1',
                    role='public-archivist',
                    name='local')

        indexer = WebRecRecorder.make_wr_indexer(manager.config)

        uploader = InplaceImporter(manager.redis,
                                   manager.config,
                                   user,
                                   indexer, '@INIT', create_coll=True)

        files = list(self.get_archive_files(self.inputs))

        uploader.multifile_upload(user, files)

        local_info=dict(user=user.name,
                        coll=uploader.the_collection.my_id,
                        rec='0',
                        type='replay-coll',
                        browser='',
                        reqid='@INIT')

        browser_redis = redis.StrictRedis.from_url(os.environ['REDIS_BROWSER_URL'])
        browser_redis.hmset('ip:127.0.0.1', local_info)
        browser_redis.hset('req:@INIT', 'ip', '127.0.0.1')

        self.save_cache();

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
        parser.add_argument('inputs', nargs='+',
                            help='web archive (.warc.gz, .warc, .arc.gz, .arc or .har files)')

        parser.add_argument('--cache-dir')


# ============================================================================
webrecorder_player = WebrecPlayerRunner.main


if __name__ == "__main__":
    webrecorder_player()

