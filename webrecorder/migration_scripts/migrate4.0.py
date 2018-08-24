import sys
import os
import datetime

# add parent dir to path to access webrecorder package
wr_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, wr_path)


from redis import StrictRedis
from fakeredis import FakeStrictRedis
import fakeredis

import json
import shutil

from six.moves.urllib.parse import urlsplit

from pywb.utils.loaders import BlockLoader

from webrecorder.rec.storage.storagepaths import add_local_store_prefix, strip_prefix

from webrecorder.models import User, Collection, Recording, BookmarkList
from webrecorder.models.stats import Stats
from webrecorder.models.usermanager import CLIUserManager, UserTable

from webrecorder.utils import sanitize_title

from argparse import ArgumentParser, RawTextHelpFormatter


# ============================================================================
class Migration(object):
    MIGRATE_Q = 'migrate:q'

    DEFAULT_LIST_NAME = 'Bookmarks'
    DEFAULT_LIST_DESC = 'List automatically created from visible pages on {0}'

    def __init__(self, old_redis_url, new_redis_url, dry_run=True,
                 per_recording_list=False, s3_import=False, s3_root=None):
        self.old_redis = StrictRedis.from_url(old_redis_url, decode_responses=True)
        self.dry_run = dry_run
        self.per_recording_list = per_recording_list
        self.s3_import = s3_import

        if s3_import:
            assert(s3_root)
            import boto3
            self.s3_root = s3_root
            self.s3 = boto3.client('s3')
        else:
            self.s3_root = None
            self.s3 = None

        if self.dry_run:
            import redis
            redis.StrictRedis = fakeredis.FakeStrictRedis
            self.redis = FakeStrictRedis.from_url(new_redis_url, decode_responses=True)
        else:
            self.redis = StrictRedis.from_url(new_redis_url, decode_responses=True)

        print('Redis Inited')

        self.cli = CLIUserManager(new_redis_url)

    def delete_user(self, username):
        user = self.cli.all_users.make_user(username)
        user.delete_me()

    def delete_coll(self, username, coll_name):
        print('Deleting Collection: {0}/{1}'.format(username, coll_name))
        user = self.cli.all_users.make_user(username)
        if not user:
            print('No User')
            return

        collection = user.get_collection_by_name(coll_name)
        if not collection:
            print('No Collection')
            return

        user.remove_collection(collection)

    def copy_key(self, from_key, to_key):
        data = self.old_redis.hgetall(from_key)
        if data:
            self.redis.hmset(to_key, data)

    def migrate_all(self):
        if not self.redis.exists(self.MIGRATE_Q):
            all_users = self.old_redis.hkeys('h:users')
            for user in all_users:
                self.redis.rpush(self.MIGRATE_Q, user)

            self.copy_key('h:register', 'h:register')
            self.copy_key('h:temp-usage', Stats.ALL_CAPTURE_TEMP_KEY)
            self.copy_key('h:user-usage', Stats.ALL_CAPTURE_USER_KEY)

            print('QUEUED USERS:', len(all_users))

        while True:
            user = self.redis.lpop(self.MIGRATE_Q)
            if not user:
                print('All Done!')
                return

            self.migrate_user(user)

    def migrate_user(self, username, new_username=None, coll_name=None, skip_if_exists=True):
        new_username = new_username or username
        print('Processing User: {0} -> {1}'.format(username, new_username))

        if new_username not in self.cli.all_users:
            # migrate from h:users and u:<info> to new user info
            user_data = self.old_redis.hget('h:users', username)
            user_data = json.loads(user_data)
            reg_data = user_data.pop('desc', '')
            if reg_data:
                user_data['reg_data'] = reg_data
                try:
                    reg_data_json = json.loads(reg_data)
                    if 'name' in reg_data_json:
                        user_data['full_name'] = reg_data_json['name']
                except:
                    pass

            user_data.pop('space_utilization', '')

            # update with u:id:info data
            old_u_key = User.INFO_KEY.format(user=username)
            user_data.update(self.old_redis.hgetall(old_u_key))

            # update new username with data
            new_u_key = User.INFO_KEY.format(user=new_username)
            self.redis.hmset(new_u_key, user_data)

            # add user to s:users, now a valid user!
            self.redis.sadd(UserTable.USERS_KEY, new_username)
        else:
            if skip_if_exists:
                print('User exists, skipping')
                return

            print('Use already exists, migrating collections')

        user = self.cli.all_users.make_user(new_username)

        if not coll_name:
            # get all collection list
            colls = self.old_redis.smembers(User.COLLS_KEY.format(user=new_username))
        else:
            colls = [coll_name]

        total_size = 0

        for coll in colls:
            print('  Processing Collection: ' + coll)
            total_size += self.migrate_collection(user, username, coll)


        if not coll_name:
            user.set_prop('size', total_size)

        try:
            target_dirname = user.make_user_temp_warc_path()
            os.rmdir(target_dirname)
        except Exception as e:
            pass
            #print('Error deleting user dir: ' + str(e))


    def migrate_collection(self, user, old_user, old_coll):
        # get old coll info data
        old_info_key = 'c:{user}:{coll}:info'.format(user=old_user, coll=old_coll)
        old_coll_data = self.old_redis.hgetall(old_info_key)

        if not old_coll_data or not old_coll_data.get('id'):
            print('  SKIPPING INVALID: ' + old_coll)
            return 0

        collection = user.create_collection(old_coll,
                                            allow_dupe=False,
                                            title=old_coll_data.get('title', ''),
                                            desc=old_coll_data.get('desc', ''),
                                            public=old_coll_data.get('r:@public') == '1')

        print('  New Collection Created: ' + collection.my_id)

        if old_coll_data.get('created_at'):
            collection.set_prop('created_at', old_coll_data.get('created_at'), update_ts=False)
        else:
            print('  OBJ ERR: created_at missing')

        #collection.set_prop('size', old_coll_data.get('size', '0'))

        collection.bookmarks_list = None

        recs = self.old_redis.smembers('c:{user}:{coll}:recs'.format(user=old_user, coll=old_coll))

        patch_recordings = {}

        total_size = 0

        for rec in recs:
            old_rec_base_key = 'r:{user}:{coll}:{rec}:'.format(user=old_user, coll=old_coll, rec=rec)
            print('    Processing Recording: ' + rec)
            recording, size = self.migrate_recording(collection, rec, old_rec_base_key)

            total_size += size

            # track patch recordings
            if recording and recording.get_prop('rec_type') == 'patch':
                print('    Patch: yes')
                id_ = self.old_redis.hget(old_rec_base_key + 'info', 'id')
                patch_recordings[id_] = recording


        collection.set_prop('size', total_size, update_ts=False)

        # add bookmarks to Bookmarks list
        if hasattr(collection, 'pages_for_bookmarks'):
            # sort pages oldest to newest
            pages = sorted(collection.pages_for_bookmarks, key=lambda x: x.get('timestamp') or x.get('ts', ''))

            for page in pages:
                bookmark = collection.bookmarks_list.create_bookmark(page)

        # map source to patch recordings, if any
        if not patch_recordings:
            return total_size

        all_recordings = collection.get_recordings()
        for recording in all_recordings:
            title = recording.get_prop('title')
            if not title:
                continue

            patch_title = 'patch-of-' + sanitize_title(title)
            patch_recording = patch_recordings.get(patch_title)
            if patch_recording:
                print('Patch Mapped ({0}) {1} -> {2}'.format(title, recording.my_id, patch_recording.my_id))
                recording.set_patch_recording(patch_recording, update_ts=False)

        return total_size

    def migrate_recording(self, collection, rec, old_rec_base_key):
        # old rec info
        old_rec_data = self.old_redis.hgetall(old_rec_base_key + 'info')

        if not old_rec_data or not old_rec_data.get('id'):
            print('SKIPPING INVALID: ' + rec)
            return None, 0

        # get remote archive list
        ra_list = self.old_redis.smembers(old_rec_base_key + 'ra')

        # set title
        title = old_rec_data.get('title', rec)
        rec_type = old_rec_data.get('rec_type')

        recording = collection.create_recording(title=title,
                                                desc='',
                                                rec_type=rec_type,
                                                ra_list=ra_list)

        print('    New Recording Created: ' + recording.my_id)

        pages = self.old_redis.hvals(old_rec_base_key + 'page')
        pages = [json.loads(page) for page in pages]
        collection.import_pages(pages, recording)

        # copy files
        warc_files = self.old_redis.hgetall(old_rec_base_key + 'warc')

        if self.s3_import:
            total_size = self.copy_rec_files_s3(collection.get_owner(), collection, recording, warc_files)
        else:
            total_size = self.copy_rec_files(collection.get_owner(), collection, recording, warc_files)

        recording.set_prop('size', total_size, update_ts=False)

        # and list for public pages
        visible_pages = [page for page in pages if page.get('hidden') != '1']

        if visible_pages:
            # shared 'Bookmarks' list
            if not collection.bookmarks_list:
                public_desc = self.DEFAULT_LIST_DESC.format(self.datestring())

                collection.bookmarks_list = collection.create_bookmark_list(dict(title=self.DEFAULT_LIST_NAME,
                                                                                 desc=public_desc,
                                                                                 public=True))

                collection.pages_for_bookmarks = []

            # per-recording list of public bookmarks
            if self.per_recording_list:
                recording_list = collection.create_bookmark_list(dict(title=title,
                                                                      public=False))
            else:
                recording_list = None

            # create bookmarks for visible pages
            for page in visible_pages:
                #page['rec'] = recording.my_id
                page['page_id'] = collection._new_page_id(page)

                print('    BOOKMARK: ' + page.get('timestamp', '') + ' ' + page.get('url', ''))

                if recording_list:
                    bookmark_1 = recording_list.create_bookmark(page)

                #bookmark_2 = collection.bookmarks_list.create_bookmark(page)
                collection.pages_for_bookmarks.append(page)

        # copy props
        if 'created_at' in old_rec_data:
            recording.set_prop('created_at', old_rec_data['created_at'], update_ts=False)
        else:
            print('    OBJ ERR: created_at missing')

        if 'updated_at' in old_rec_data:
            recording.set_prop('updated_at', old_rec_data['updated_at'], update_ts=False)
            recording.set_prop('recorded_at', old_rec_data['updated_at'], update_ts=False)
        else:
            print('    OBJ ERR: updated_at missing')

        return recording, total_size

    def copy_rec_files_s3(self, user, collection, recording, warc_files):
        coll_warc_key = recording.COLL_WARC_KEY.format(coll=collection.my_id)
        rec_warc_key = recording.REC_WARC_KEY.format(rec=recording.my_id)

        # Copy WARCs
        total_size = 0

        coll_root = self.s3_root + collection.get_dir_path() + '/'

        for n, url in warc_files.items():
            if not url.startswith('s3://'):
                print('Skipping: ' + url)
                continue

            src_parts = urlsplit(url)
            src_bucket = src_parts.netloc
            src_key = src_parts.path.lstrip('/')

            try:
                res = self.s3.head_object(Bucket=src_bucket,
                                          Key=src_key)
            except Exception as e:
                print('Skipping: ' + url)
                print(e)
                continue

            size = res['ContentLength']

            if n != recording.INDEX_FILE_KEY:
                target_file = coll_root + 'warcs/' + n

                self.redis.hset(coll_warc_key, n, target_file)
                self.redis.sadd(rec_warc_key, n)
                total_size += size
            else:
                target_file = coll_root + 'indexes/' + os.path.basename(url)
                recording.set_prop(n, target_file, update_ts=False)

            # target
            target_parts = urlsplit(target_file)
            target_bucket = target_parts.netloc
            target_key = target_parts.path.lstrip('/')

            params = dict(Bucket=target_bucket,
                          Key=target_key,
                          CopySource=dict(Bucket=src_bucket, Key=src_key))

            print('    Copying:')
            print('      From: s3://' + src_bucket + '/' + src_key)
            print('      To: s3://' + target_bucket + '/' + target_key)
            print('      Size: ' + str(size))

            try:
                if not self.dry_run:
                    res = self.s3.copy_object(**params)
            except Exception as e:
                print('    ERROR:')
                print(e)

        return total_size

    def copy_rec_files(self, user, collection, recording, warc_files):
        if self.dry_run:
            target_dirname = os.path.join('/tmp/migrate4.0', collection.my_id)
        else:
            target_dirname = user.get_user_temp_warc_path()

        os.makedirs(target_dirname, exist_ok=True)
        print('Writing to dir: ' + target_dirname)

        coll_warc_key = recording.COLL_WARC_KEY.format(coll=collection.my_id)
        rec_warc_key = recording.REC_WARC_KEY.format(rec=recording.my_id)

        # Copy WARCs
        loader = BlockLoader()
        total_size = 0

        for n, url in warc_files.items():
            if not url.startswith('s3://'):
                print('FILE ERR: Skipping local file: ' + url)
                continue

            local_filename = n if n != recording.INDEX_FILE_KEY else os.path.basename(url)
            target_file = os.path.join(target_dirname, local_filename)

            src = loader.load(url)

            try:
                with open(target_file, 'wb') as dest:
                    print('Copying {0} -> {1}'.format(url, target_file))
                    shutil.copyfileobj(src, dest)
                    size = dest.tell()

                target_file = add_local_store_prefix(target_file)
                if n != recording.INDEX_FILE_KEY:
                    self.redis.hset(coll_warc_key, n, target_file)
                    self.redis.sadd(rec_warc_key, n)
                    total_size += size
                else:
                    recording.set_prop(n, target_file, update_ts=False)

                if self.dry_run:
                    os.remove(strip_prefix(target_file))

            except:
                import traceback
                traceback.print_exc()

        # commit from temp dir to storage
        if not self.dry_run:
            recording.commit_to_storage()

        return total_size

    def datestring(self):
        return datetime.datetime.utcnow().isoformat()[:19].replace('T', ' ')


# ============================================================================
def main(args=None):
    desc = """Migrate Webrecorder 3.x -> Webrecorder 4.x data model.

Recommended usage for migrating from a Webrecorder 3.x installation:

1) Update REDIS_BASE_URL in wr.env to redis://redis/2 to use a blank new Redis DB

2) Recreate Webrecorder containers via ./recreate.sh, which will remove old containers and build new ones.

3) docker exec -it webrecorder_app_1 python ./migration_scripts/migrate4.0.py --new-redis=redis://redis/2

New data will be stored in redis db 2 and under ./data/storage/
Old data will remain in redis db 1 and under ./data/warcs

"""

    parser = ArgumentParser(description=desc,
                            formatter_class=RawTextHelpFormatter)

    parser.add_argument('--old-redis', default='redis://redis:6379/1', help='Source redis url for old data')
    parser.add_argument('--new-redis', default='redis://redis:6379/2',
                        help='Target redis url for new data, should correspond to REDIS_BASE_URL when running Webrecorder')

    parser.add_argument('--run-import', default=False, action='store_true', help='Run the import and copy data, defaults to false (dry run)')

    parser.add_argument('--user', help='Import a single user only')
    parser.add_argument('--coll', help='Import a single collection only')

    parser.add_argument('--skip-user-if-exists', help='Skip user completely if already exists')
    parser.add_argument('--overwrite', default=False, action='store_true', help='Delete existing user and collection before importing')

    parser.add_argument('--per-recording-list', default=False, action='store_true',
                        help='Generate a list of bookmarks for each recording session')

    parser.add_argument('--s3-root', default=os.environ.get('S3_ROOT'),
                        help='Target S3 url s3://bucket/prefix/ for importing data to s3, required for s3 import, defaults to S3_ROOT env variable')

    parser.add_argument('--s3-import', default=False, action='store_true', help='Use S3 based copy, useful when migrating from one s3 path to another')

    res = parser.parse_args(args=args)

    dry_run = not res.run_import
    if dry_run:
        print('Dry run, add --run-import to actually run the import')
        print('')

    m = Migration(old_redis_url=res.old_redis,
                  new_redis_url=res.new_redis,
                  dry_run=dry_run,
                  per_recording_list=res.per_recording_list,
                  s3_root=res.s3_root,
                  s3_import=res.s3_import)

    # import single user
    if res.user and not res.coll:
        if res.overwrite:
            m.delete_user(res.user)

        m.migrate_user(res.user, skip_if_exists=res.skip_user_if_exists)

    # import single user and collection
    elif res.user and res.coll:
        if res.overwrite:
            m.delete_coll(res.user, res.coll)

        m.migrate_user(res.user, coll_name=res.coll, skip_if_exists=res.skip_user_if_exists)

    elif not res.user and res.coll:
        print('Invalid Args, a --user must be specified along with a --coll argument')
        sys.exit(1)

    # import all
    else:
        m.migrate_all()


# ============================================================================
if __name__ == '__main__':
    main()

