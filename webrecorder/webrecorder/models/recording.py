import json
import hashlib
import os
import base64
import shutil

from six.moves.urllib.parse import urlsplit

from pywb.utils.canonicalize import calc_search_range
from pywb.warcserver.index.cdxobject import CDXObject

from pywb.utils.loaders import BlockLoader

from webrecorder.utils import redis_pipeline
from webrecorder.models.base import RedisUniqueComponent, RedisUnorderedList
from webrecorder.models.stats import Stats
from webrecorder.rec.storage.storagepaths import strip_prefix, add_local_store_prefix
from webrecorder.rec.storage import LocalFileStorage

from warcio.timeutils import timestamp_now, sec_to_timestamp, timestamp20_now


# ============================================================================
class Recording(RedisUniqueComponent):
    MY_TYPE = 'rec'
    INFO_KEY = 'r:{rec}:info'
    ALL_KEYS = 'r:{rec}:*'

    OPEN_REC_KEY = 'r:{rec}:open'

    CDXJ_KEY = 'r:{rec}:cdxj'

    RA_KEY = 'r:{rec}:ra'

    PENDING_SIZE_KEY = 'r:{rec}:_ps'
    PENDING_COUNT_KEY = 'r:{rec}:_pc'
    PENDING_TTL = 90

    REC_WARC_KEY = 'r:{rec}:wk'
    COLL_WARC_KEY = 'c:{coll}:warc'

    COMMIT_LOCK_KEY = 'r:{rec}:lock'

    INDEX_FILE_KEY = '@index_file'

    INDEX_NAME_TEMPL = 'index-{timestamp}-{random}.cdxj'

    DELETE_RETRY = 'q:delete_retry'

    # overridable
    OPEN_REC_TTL = 5400

    @classmethod
    def init_props(cls, config):
        cls.OPEN_REC_TTL = int(config['open_rec_ttl'])
        #cls.INDEX_FILE_KEY = config['info_index_key']

        cls.CDXJ_KEY = config.get('cdxj_key_templ', cls.CDXJ_KEY)
        #cls.INDEX_NAME_TEMPL = config['index_name_templ']

        #cls.COMMIT_WAIT_TEMPL = config['commit_wait_templ']

    @property
    def name(self):
        return self.my_id

    def init_new(self, title='', desc='', rec_type=None, ra_list=None):
        rec = self._create_new_id()

        open_rec_key = self.OPEN_REC_KEY.format(rec=rec)

        self.data = {
                     'title': title,
                     'desc': desc,
                     'size': 0,
                    }

        if rec_type:
            self.data['rec_type'] = rec_type

        with redis_pipeline(self.redis) as pi:
            self._init_new(pi)

            if ra_list:
                ra_key = self.RA_KEY.format(rec=self.my_id)
                pi.sadd(ra_key, *ra_list)

            pi.setex(open_rec_key, self.OPEN_REC_TTL, 1)

        return rec

    def is_open(self, extend=True):
        open_rec_key = self.OPEN_REC_KEY.format(rec=self.my_id)
        if extend:
            return self.redis.expire(open_rec_key, self.OPEN_REC_TTL)
        else:
            return self.redis.exists(open_rec_key)

    def set_closed(self):
        open_rec_key = self.OPEN_REC_KEY.format(rec=self.my_id)
        self.redis.delete(open_rec_key)

    def is_fully_committed(self):
        if self.get_pending_count() > 0:
            return False

        cdxj_key = self.CDXJ_KEY.format(rec=self.my_id)
        return self.redis.exists(cdxj_key) == False

    def get_pending_count(self):
        pending_count = self.PENDING_COUNT_KEY.format(rec=self.my_id)
        return int(self.redis.get(pending_count) or 0)

    def get_pending_size(self):
        pending_size = self.PENDING_SIZE_KEY.format(rec=self.my_id)
        return int(self.redis.get(pending_size) or 0)

    def inc_pending_count(self):
        if not self.is_open(extend=False):
            return

        pending_count = self.PENDING_COUNT_KEY.format(rec=self.my_id)
        self.redis.incrby(pending_count, 1)
        self.redis.expire(pending_count, self.PENDING_TTL)

    def inc_pending_size(self, size):
        if not self.is_open(extend=False):
            return

        pending_size = self.PENDING_SIZE_KEY.format(rec=self.my_id)
        self.redis.incrby(pending_size, size)
        self.redis.expire(pending_size, self.PENDING_TTL)

    def dec_pending_count_and_size(self, size):
        # return if rec no longer exists (deleted while transfer is pending)
        if not self.redis.exists(self.info_key):
            return

        pending_count = self.PENDING_COUNT_KEY.format(rec=self.my_id)
        self.redis.incrby(pending_count, -1)

        pending_size = self.PENDING_SIZE_KEY.format(rec=self.my_id)
        self.redis.incrby(pending_size, -size)

    def serialize(self,
                  include_pages=False,
                  convert_date=True,
                  export_filter=False,
                  include_files=False):

        data = super(Recording, self).serialize(include_duration=True,
                                                convert_date=convert_date)

        if include_pages:
            data['pages'] = self.get_owner().list_rec_pages(self)

        # add any remote archive sources
        ra_key = self.RA_KEY.format(rec=self.my_id)
        data['ra_sources'] = list(self.redis.smembers(ra_key))

        if include_files:
            files = {}
            files['warcs'] = [n for n, v in self.iter_all_files(include_index=False)]
            index_file = self.get_prop(self.INDEX_FILE_KEY)
            if index_file:
                files['indexes'] = [os.path.basename(index_file)]

            data['files'] = files

        data.pop(self.INDEX_FILE_KEY, '')

        return data

    def delete_me(self, storage, pages=True):
        res = self.delete_files(storage)

        Stats(self.redis).incr_delete(self)

        # if deleting collection, no need to remove pages for each recording
        # they'll be deleted with the collection
        if pages:
            self.get_owner().delete_rec_pages(self)

        if not self.delete_object():
            res['error'] = 'not_found'

        return res

    def _coll_warc_key(self):
        return self.COLL_WARC_KEY.format(coll=self.get_prop('owner'))

    def iter_all_files(self, include_index=False):
        warc_key = self.REC_WARC_KEY.format(rec=self.my_id)

        rec_warc_keys = self.redis.smembers(warc_key)

        if rec_warc_keys:
            all_files = self.redis.hmget(self._coll_warc_key(), rec_warc_keys)

            for n, v in zip(rec_warc_keys, all_files):
                yield n, v

        if include_index:
            index_file = self.get_prop(self.INDEX_FILE_KEY)
            if index_file:
                yield self.INDEX_FILE_KEY, index_file

    def delete_files(self, storage):
        errs = []

        coll_warc_key = self._coll_warc_key()

        local_storage = LocalFileStorage(self.redis)

        for n, v in self.iter_all_files(include_index=True):
            success = storage.delete_file(v)

            # if delete with default storage failed,
            #  may be a local, uncomitted file, that must be deleted with local storage
            if not success:
                success = local_storage.delete_file(v)

            if not success:
                errs.append(v)

                # queue file to retry deletion later
                self.redis.rpush(self.DELETE_RETRY, v)
            else:
                self.redis.hdel(coll_warc_key, n)

        if errs:
            return {'error_delete_files': errs}
        else:
            return {}

    def track_remote_archive(self, pi, source_id):
        ra_key = self.RA_KEY.format(rec=self.my_id)
        pi.sadd(ra_key, source_id)

    def set_patch_recording(self, patch_recording, update_ts=True):
        if patch_recording:
            self.set_prop('patch_rec', patch_recording.my_id, update_ts=update_ts)

    def get_patch_recording(self):
        patch_rec = self.get_prop('patch_rec')
        if patch_rec:
            return self.get_owner().get_recording(patch_rec)

    def write_cdxj(self, user, cdxj_key):
        #full_filename = self.redis.hget(warc_key, self.INDEX_FILE_KEY)
        full_filename = self.get_prop(self.INDEX_FILE_KEY)
        if full_filename:
            cdxj_filename = os.path.basename(strip_prefix(full_filename))
            return cdxj_filename, full_filename

        dirname = user.get_user_temp_warc_path()

        randstr = base64.b32encode(os.urandom(5)).decode('utf-8')

        timestamp = timestamp_now()

        cdxj_filename = self.INDEX_NAME_TEMPL.format(timestamp=timestamp,
                                                     random=randstr)

        os.makedirs(dirname, exist_ok=True)

        full_filename = os.path.join(dirname, cdxj_filename)

        cdxj_list = self.redis.zrange(cdxj_key, 0, -1)

        with open(full_filename, 'wt') as out:
            for cdxj in cdxj_list:
                out.write(cdxj + '\n')
            out.flush()

        full_url = add_local_store_prefix(full_filename.replace(os.path.sep, '/'))
        #self.redis.hset(warc_key, self.INDEX_FILE_KEY, full_url)
        self.set_prop(self.INDEX_FILE_KEY, full_url)

        return cdxj_filename, full_filename

    def commit_to_storage(self, storage=None):
        commit_lock = self.COMMIT_LOCK_KEY.format(rec=self.my_id)
        if not self.redis.setnx(commit_lock, '1'):
            return

        collection = self.get_owner()
        user = collection.get_owner()

        if not storage and not user.is_anon():
            storage = collection.get_storage()

        info_key = self.INFO_KEY.format(rec=self.my_id)
        cdxj_key = self.CDXJ_KEY.format(rec=self.my_id)
        warc_key = self.COLL_WARC_KEY.format(coll=collection.my_id)

        self.redis.publish('close_rec', info_key)

        cdxj_filename, full_cdxj_filename = self.write_cdxj(user, cdxj_key)

        all_done = True

        if storage:
            all_done = collection.commit_file(cdxj_filename, full_cdxj_filename, 'indexes',
                                        info_key, self.INDEX_FILE_KEY, direct_delete=True)

            for warc_filename, warc_full_filename in self.iter_all_files():
                done = collection.commit_file(warc_filename, warc_full_filename, 'warcs', warc_key)

                all_done = all_done and done

        if all_done:
            print('Deleting Redis Key: ' + cdxj_key)
            self.redis.delete(cdxj_key)

        self.redis.delete(commit_lock)

    def _copy_prop(self, source, name):
        prop = source.get_prop(name)
        if prop:
            self.set_prop(name, prop)

    def copy_data_from_recording(self, source, delete_source=False):
        if self == source:
            return False

        if not self.is_open():
            return False

        errored = False

        self._copy_prop(source, 'title')
        self._copy_prop(source, 'desc')
        self._copy_prop(source, 'rec_type')
        self._copy_prop(source, 'recorded_at')
        #self._copy_prop(source, 'patch_rec')

        collection = self.get_owner()
        user = collection.get_owner()

        target_dirname = user.get_user_temp_warc_path()
        target_warc_key = self.COLL_WARC_KEY.format(coll=collection.my_id)

        # Copy WARCs
        loader = BlockLoader()

        for n, url in source.iter_all_files(include_index=True):
            local_filename = n + '.' + timestamp20_now()
            target_file = os.path.join(target_dirname, local_filename)

            src = loader.load(url)

            try:
                with open(target_file, 'wb') as dest:
                    print('Copying {0} -> {1}'.format(url, target_file))
                    shutil.copyfileobj(src, dest)
                    size = dest.tell()

                if n != self.INDEX_FILE_KEY:
                    self.incr_size(size)
                    self.redis.hset(target_warc_key, n, add_local_store_prefix(target_file))
                else:
                    self.set_prop(n, target_file)

            except:
                import traceback
                traceback.print_exc()
                errored = True

        # COPY cdxj, if exists
        source_key = self.CDXJ_KEY.format(rec=source.my_id)
        target_key = self.CDXJ_KEY.format(rec=self.my_id)

        self.redis.zunionstore(target_key, [source_key])

        # recreate pages, if any, in new recording
        source_coll = source.get_owner()
        source_pages = source_coll.list_rec_pages(source)
        collection.import_pages(source_pages, self)

        # COPY remote archives, if any
        self.redis.sunionstore(self.RA_KEY.format(rec=self.my_id),
                               self.RA_KEY.format(rec=source.my_id))

        # COPY recording warc keys
        self.redis.sunionstore(self.REC_WARC_KEY.format(rec=self.my_id),
                               self.REC_WARC_KEY.format(rec=source.my_id))

        # sync collection cdxj, if exists
        collection.sync_coll_index(exists=True, do_async=True)

        if not errored and delete_source:
            collection = source.get_owner()
            collection.remove_recording(source, delete=True)

        return not errored
