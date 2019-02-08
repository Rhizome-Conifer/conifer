import gevent
import base64
import os
import yaml

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
        self.coll_dir = argres.coll_dir
        self.serializer = None
        self.cache_dir = None

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

        if self.inputs:
            cache_dir = os.path.join(os.path.dirname(self.inputs[0]), cache_dir)
            try:
                os.makedirs(cache_dir)
            except OSError:
                pass

            name = os.path.basename(self.inputs[0]) +'-cache.json.gz'
            cache_db = os.path.join(cache_dir, name)

            self.cache_dir = cache_dir
            self.serializer = FakeRedisSerializer(cache_db, self.inputs)

    def admin_init(self):
        if self.coll_dir:
            self.load_coll_dir()

        if self.inputs:
            if self.load_cache():
                return

            pool = ThreadPool(maxsize=1)
            pool.spawn(self.safe_auto_load_warcs)

    def load_coll_dir(self):
        metadata_file = os.path.join(self.coll_dir, 'metadata', 'metadata.yaml')
        try:
            user_manager, user = self._init_user_manager()

            with open(metadata_file) as fh:
                data = yaml.load(fh.read())

            coll = data['collection']

            logging.debug('Begin Import of: ' + metadata_file)

            collection = user.create_collection('collection',
                                                title=coll['title'],
                                                desc=coll['desc'],
                                                public=True,
                                                public_index=True)

            collection.import_serialized(coll, self.coll_dir)

            self._init_browser_redis(user, collection)

            logging.debug('Imported Collection from ' + self.coll_dir)

        except Exception as e:
            logging.debug('Could not load from {0}: {1}'.format(metadata_file, e))
            if logging.getLogger().getEffectiveLevel() == logging.DEBUG:
                traceback.print_exc()

    def load_cache(self):
        if not self.serializer:
            logging.debug('No Serializer, indexing')
            return False

        if not self.inputs:
            logging.debug('Not Loading WARCs')

        if not self.serializer.load_db():
            logging.debug('Index Not Loaded from cache, Reindexing')

        user_manager = CLIUserManager()

        try:
            user = user_manager.all_users['local']
        except:
            logging.debug('Cached Index Invalid, missing user')
            return False

        collection = user.get_collection_by_name('collection')
        if not collection:
            logging.debug('Cached Index Invalid, missing collection')
            return False

        self._init_browser_redis(user, collection)

        logging.debug('Index Loaded from Cache, Skipping Reindex')
        return True

    def save_cache(self, user_manager, user):
        if not self.serializer:
            return

        try:
            #user_manager = CLIUserManager()
            #user = user_manager.all_users['local']

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
        manager, user = self._init_user_manager()

        indexer = WebRecRecorder.make_wr_indexer(manager.config)

        uploader = InplaceImporter(manager.redis,
                                   manager.config,
                                   user,
                                   indexer, '@INIT', create_coll=True,
                                   cache_dir=self.cache_dir)

        files = list(self.get_archive_files(self.inputs))

        uploader.multifile_upload(user, files)

        self._init_browser_redis(user, uploader.the_collection)

        self.save_cache(manager, user)

    def _init_user_manager(self):
        user_manager = CLIUserManager()
        user, _ = user_manager.create_user(
                email='test@localhost',
                username='local',
                passwd='LocalUser1',
                role='public-archivist',
                name='local')

        return user_manager, user

    def _init_browser_redis(self, user, collection):
        local_info=dict(user=user.name,
                        coll=collection.my_id,
                        rec='0',
                        type='replay-coll',
                        browser='',
                        reqid='@INIT')

        browser_redis = redis.StrictRedis.from_url(os.environ['REDIS_BROWSER_URL'])
        browser_redis.hmset('up:127.0.0.1', local_info)
        browser_redis.hset('req:@INIT', 'ip', '127.0.0.1')

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
        parser.add_argument('inputs', nargs='*',
                            help='web archive file (.warc.gz, .warc, .arc.gz, .arc or .har)')

        parser.add_argument('--coll-dir',
                            help='init from existing Webrecorder collection directory')

        parser.add_argument('--cache-dir',
                            help='Writable directory to cache state (including CDXJ index) to avoid reindexing on load')


# ============================================================================
webrecorder_player = WebrecPlayerRunner.main


if __name__ == "__main__":
    webrecorder_player()

