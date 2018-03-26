import os
import redis
import base64
import json
import time

from warcio.timeutils import sec_to_timestamp, timestamp_now

from webrecorder.models.recording import Recording
from webrecorder.models.base import BaseAccess

from webrecorder.rec.storage.s3 import S3Storage
from webrecorder.rec.storage.local import LocalFileStorage
from webrecorder.rec.storage.f4 import F4Storage

from tempfile import NamedTemporaryFile


# ============================================================================
class StorageCommitter(object):
    DEL_Q = 'q:del:{name}'
    MOVE_Q = 'q:move:{name}'

    def __init__(self, config):
        super(StorageCommitter, self).__init__()

        self.redis_base_url = os.environ['REDIS_BASE_URL']

        self.redis = redis.StrictRedis.from_url(self.redis_base_url, decode_responses=True)

        self.record_root_dir = os.environ['RECORD_ROOT']

        self.warc_path_templ = config['warc_path_templ']
        self.warc_path_templ = self.record_root_dir + self.warc_path_templ

        self.warc_key_templ = config['warc_key_templ']

        self.commit_wait_templ = config['commit_wait_templ']
        self.commit_wait_secs = int(config['commit_wait_secs'])

        self.index_name_templ = config['index_name_templ']
        self.info_index_key = config['info_index_key']

        self.full_warc_prefix = config['full_warc_prefix']

        self.all_cdxj_templ = config['cdxj_key_templ'].format(rec='*')

        self.temp_prefix = config['temp_prefix']

        self.storage_key_templ = config['storage_key_templ']

        # set storage dir to be next to record dir, if not set
        if 'STORAGE_ROOT' not in os.environ:
            os.environ['STORAGE_ROOT'] = os.path.abspath(os.path.join(self.record_root_dir, '..', 'storage'))

        self.storage_map = {}
        self.storage_map['local'] = LocalFileStorage(config)

        self.default_store = os.environ.get('DEFAULT_STORAGE', 'local')
        if self.default_store == 's3':
            self.storage_map['s3'] = S3Storage(config)

        elif self.default_store == 'f4':
            self.storage_map['f4'] = F4Storage(config)

        print('Storage Committer Root: ' + self.record_root_dir)

    def strip_prefix(self, uri):
        if self.full_warc_prefix and uri.startswith(self.full_warc_prefix):
            return uri[len(self.full_warc_prefix):]

        return uri

    def commit_file(self, user, collection, recording,
                    filename, full_filename, obj_type,
                    update_key, update_prop=None, direct_delete=False):

        if user.is_anon():
            return False

        full_filename = self.strip_prefix(full_filename)

        # not a local filename
        if '://' in full_filename and not full_filename.startswith('local'):
            return False

        #full_filename = os.path.join(dirname, filename)

        storage = self.get_storage(user, collection)
        if not storage:
            return False

        if not os.path.isfile(full_filename):
            return False

        commit_wait = self.commit_wait_templ.format(filename=full_filename)

        if self.redis.set(commit_wait, 1, ex=self.commit_wait_secs, nx=True):
            if not storage.upload_file(user, collection, recording,
                                       filename, full_filename, obj_type):

                self.redis.delete(commit_wait)
                return False

        # already uploaded, see if it is accessible
        # if so, finalize and delete original
        remote_url = storage.get_upload_url(filename)
        if not remote_url:
            print('Not yet available: {0}'.format(full_filename))
            return False

        print('Committed {0} -> {1}'.format(full_filename, remote_url))
        update_prop = update_prop or filename
        self.redis.hset(update_key, update_prop, remote_url)

        # if direct delete, call os.remove directly
        # used for CDXJ files which are not owned by a writer
        if direct_delete:
            try:
                os.remove(full_filename)
            except Exception as e:
                print(e)
                return True
        else:
        # for WARCs, send handle_delete to ensure writer can close the file
             if self.redis.publish('handle_delete', full_filename) < 1:
                print('No Delete Listener!')

        return True

    def write_cdxj(self, user, warc_key, cdxj_key, info_key):
        full_filename = self.redis.hget(warc_key, self.info_index_key)
        if full_filename:
            cdxj_filename = os.path.basename(self.strip_prefix(full_filename))
            return cdxj_filename, full_filename

        dirname = os.path.join(self.record_root_dir, user.name)

        randstr = base64.b32encode(os.urandom(5)).decode('utf-8')

        try:
            timestamp = sec_to_timestamp(int(self.redis.hget(info_key, 'updated_at')))
        except:
            timestamp = timestamp_now()

        cdxj_filename = self.index_name_templ.format(timestamp=timestamp,
                                                     random=randstr)

        os.makedirs(dirname, exist_ok=True)

        full_filename = os.path.join(dirname, cdxj_filename)

        cdxj_list = self.redis.zrange(cdxj_key, 0, -1)

        with open(full_filename, 'wt') as out:
            for cdxj in cdxj_list:
                out.write(cdxj + '\n')
            out.flush()

        full_url = self.full_warc_prefix + full_filename.replace(os.path.sep, '/')
        self.redis.hset(warc_key, self.info_index_key, full_url)

        return cdxj_filename, full_filename

    def process_deletes(self, storage_type, name=None):
        name = name or storage_type
        del_q = self.DEL_Q.format(name=name)

        storage = self.storage_map.get(storage_type)
        if not storage:
            return

        while True:
            uri = self.redis.lpop(del_q)
            if not uri:
                break

            try:
                print('Deleting: ' + uri)
                # do the deletion
                storage.delete_file(uri)
            except Exception as e:
                import traceback
                traceback.print_exc()

    def process_moves(self, storage_type):
        mov_q = self.MOVE_Q.format(name=storage_type)

        while True:
            data = self.redis.lpop(mov_q)
            if not data:
                break

            move = json.loads(data)

            print('Move Request: ' + data)
            self.commit_recording(move['rec'])

    def __call__(self):
        self.process_deletes('s3')
        self.process_deletes('f4', 'fcrepo:8080')
        self.process_moves('local')

        for cdxj_key in self.redis.scan_iter(self.all_cdxj_templ):
            self.process_cdxj_key(cdxj_key)

        self.redis.publish('close_idle', '')

    def process_cdxj_key(self, cdxj_key):
        base_key = cdxj_key.rsplit(':cdxj', 1)[0]
        if self.redis.exists(base_key + ':open'):
            return

        #_, user, coll, rec = base_key.split(':', 3)
        _, rec = base_key.split(':', 1)

        self.commit_recording(rec, cdxj_key)

    def commit_recording(self, rec, cdxj_key=None):
        recording = Recording(my_id=rec,
                              redis=self.redis,
                              access=BaseAccess())

        collection = recording.get_owner()
        if not collection:
            print('No Coll Id For: ' + str(rec))
            return

        user = collection.get_owner()

        if not cdxj_key:
            cdxj_key = Recording.CDXJ_KEY.format(rec=rec)

        warc_key = Recording.WARC_KEY.format(rec=rec)
        warcs = self.redis.hgetall(warc_key)

        info_key = Recording.INFO_KEY.format(rec=rec)

        self.redis.publish('close_rec', info_key)

        cdxj_filename, full_cdxj_filename = self.write_cdxj(user, warc_key, cdxj_key, info_key)

        all_done = True

        if not user.is_anon():
            all_done = self.commit_file(user, collection, recording,
                                        cdxj_filename, full_cdxj_filename, 'indexes',
                                        warc_key, self.info_index_key, direct_delete=True)

            for warc_filename in warcs.keys():
                # skip index, not a warc
                if warc_filename == self.info_index_key:
                    continue

                warc_full_filename = warcs[warc_filename]
                done = self.commit_file(user, collection, recording,
                                        warc_filename, warc_full_filename, 'warcs',
                                        warc_key)

                all_done = all_done and done

        if all_done:
            print('Deleting Redis Key: ' + cdxj_key)
            self.redis.delete(cdxj_key)

    def get_storage(self, user, collection):
        if user.is_anon():
            return None

        storage_type = collection.get_prop('storage_type')

        storage = None

        if storage_type:
            storage = self.storage_map.get(storage_type)

        if not storage:
            storage = self.storage_map[self.default_store]

        return storage


# =============================================================================
if __name__ == "__main__":
    from webrecorder.rec.worker import Worker
    Worker(StorageCommitter).run()


