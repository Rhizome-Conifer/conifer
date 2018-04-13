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

from tempfile import NamedTemporaryFile


# ============================================================================
class StorageCommitter(object):
    DEL_Q = 'q:del:{name}'
    MOVE_Q = 'q:move:{name}'
    COPY_Q = 'q:copy'

    def __init__(self, config):
        super(StorageCommitter, self).__init__()

        self.redis_base_url = os.environ['REDIS_BASE_URL']

        self.redis = redis.StrictRedis.from_url(self.redis_base_url, decode_responses=True)

        #self.record_root_dir = os.environ['RECORD_ROOT']

        self.all_cdxj_templ = config['cdxj_key_templ'].format(rec='*')

        # set storage dir to be next to record dir, if not set
        #if 'STORAGE_ROOT' not in os.environ:
        #    os.environ['STORAGE_ROOT'] = os.path.abspath(os.path.join(self.record_root_dir, '..', 'storage'))

        self.storage_map = {}
        self.storage_map['local'] = LocalFileStorage(config)

        self.default_store = os.environ.get('DEFAULT_STORAGE', 'local')
        if self.default_store == 's3':
            self.storage_map['s3'] = S3Storage(config)

        print('Storage Committer Started')
        print('Record Root: ' + os.environ['RECORD_ROOT'])
        print('Storage Root: ' + os.environ['STORAGE_ROOT'])

    def strip_prefix(self, uri):
        if self.full_warc_prefix and uri.startswith(self.full_warc_prefix):
            return uri[len(self.full_warc_prefix):]

        return uri

    def process_deletes(self, storage_type):
        del_q = self.DEL_Q.format(name=storage_type)

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

            recording = Recording(my_id=move['rec'],
                                  redis=self.redis,
                                  access=BaseAccess())

            recording.set_closed()

            storage = self.get_storage(recording.get_owner())
            recording.commit_to_storage(storage)

    def process_copy(self):
        copy_q = self.COPY_Q

        while True:
            data = self.redis.lpop(copy_q)
            if not data:
                break

            copy = json.loads(data)

            print('Copy Request: ' + data)

            source = Recording(my_id=copy['source'],
                               name=copy['source_name'],
                               redis=self.redis,
                               access=BaseAccess())

            target = Recording(my_id=copy['target'],
                               name=copy['target_name'],
                               redis=self.redis,
                               access=BaseAccess())

            target.copy_data_from_recording(source)

            if copy.get('delete_source'):
                collection = source.get_owner()
                collection.remove_recording(source, delete=True)

    def __call__(self):
        self.process_deletes('s3')
        self.process_moves('local')
        self.process_copy()

        for cdxj_key in self.redis.scan_iter(self.all_cdxj_templ):
            self.process_cdxj_key(cdxj_key)

        self.redis.publish('close_idle', '')

    def process_cdxj_key(self, cdxj_key):
        _, rec, _2 = cdxj_key.split(':', 2)

        recording = Recording(my_id=rec,
                              redis=self.redis,
                              access=BaseAccess())

        if not recording.is_open(extend=False):
            storage = self.get_storage(recording.get_owner())
            recording.commit_to_storage(storage)

    def get_storage(self, collection):
        user = collection.get_owner()

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


