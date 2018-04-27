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
from webrecorder.rec.storage.storagepaths import strip_prefix, add_local_store_prefix

from warcio.timeutils import timestamp_now, sec_to_timestamp, timestamp20_now


# ============================================================================
class Recording(RedisUniqueComponent):
    MY_TYPE = 'rec'
    INFO_KEY = 'r:{rec}:info'
    ALL_KEYS = 'r:{rec}:*'

    OPEN_REC_KEY = 'r:{rec}:open'

    #PAGES_KEY = 'r:{rec}:p'

    CDXJ_KEY = 'r:{rec}:cdxj'

    RA_KEY = 'r:{rec}:ra'

    REC_WARC_KEY = 'r:{rec}:wk'
    COLL_WARC_KEY = 'c:{coll}:warc'

    INDEX_FILE_KEY = '@index_file'

    COMMIT_WAIT_TEMPL = 'w:{filename}'

    INDEX_NAME_TEMPL = 'index-{timestamp}-{random}.cdxj'

    # overridable
    OPEN_REC_TTL = 5400

    COMMIT_WAIT_SECS = 30

    @classmethod
    def init_props(cls, config):
        cls.OPEN_REC_TTL = int(config['open_rec_ttl'])
        #cls.INDEX_FILE_KEY = config['info_index_key']

        cls.CDXJ_KEY = config.get('cdxj_key_templ', cls.CDXJ_KEY)
        #cls.INDEX_NAME_TEMPL = config['index_name_templ']

        cls.COMMIT_WAIT_SECS = int(config['commit_wait_secs'])
        #cls.COMMIT_WAIT_TEMPL = config['commit_wait_templ']

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

    def serialize(self, include_pages=False):
        data = super(Recording, self).serialize(include_duration=True)

        if include_pages:
            data['pages'] = self.get_owner().list_rec_pages(self)

        # add any remote archive sources
        ra_key = self.RA_KEY.format(rec=self.my_id)
        data['ra_sources'] = list(self.redis.smembers(ra_key))
        return data

    def delete_me(self, storage, pages=True):
        res = self.delete_files(storage)

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

        #all_files = self.redis.hgetall(warc_key)
        all_file_keys = self.redis.smembers(warc_key)

        all_files = self.redis.hmget(self._coll_warc_key(), all_file_keys)

        for n, v in zip(all_file_keys, all_files):
            yield n, v

        if include_index:
            index_file = self.get_prop(self.INDEX_FILE_KEY)
            if index_file:
                yield self.INDEX_FILE_KEY, index_file

    def delete_files(self, storage):
        errs = []

        coll_warc_key = self._coll_warc_key()

        for n, v in self.iter_all_files(include_index=True):
            if not storage.delete_file(v):
                errs.append(v)
            else:
                self.redis.hdel(coll_warc_key, n)

        if errs:
            return {'error_delete_files': errs}
        else:
            return {}

    def track_remote_archive(self, pi, source_id):
        ra_key = self.RA_KEY.format(rec=self.my_id)
        pi.sadd(ra_key, source_id)

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

    def commit_to_storage(self):
        collection = self.get_owner()
        user = collection.get_owner()

        if not user.is_anon():
            storage = collection.get_storage()
        else:
            storage = None

        info_key = self.INFO_KEY.format(rec=self.my_id)
        cdxj_key = self.CDXJ_KEY.format(rec=self.my_id)
        warc_key = self.COLL_WARC_KEY.format(coll=collection.my_id)

        self.redis.publish('close_rec', info_key)

        cdxj_filename, full_cdxj_filename = self.write_cdxj(user, cdxj_key)

        all_done = True

        if storage:
            all_done = self.commit_file(user, collection, storage,
                                        cdxj_filename, full_cdxj_filename, 'indexes',
                                        info_key, self.INDEX_FILE_KEY, direct_delete=True)

            for warc_filename, warc_full_filename in self.iter_all_files():
                done = self.commit_file(user, collection, storage,
                                        warc_filename, warc_full_filename, 'warcs',
                                        warc_key)

                all_done = all_done and done

        if all_done:
            print('Deleting Redis Key: ' + cdxj_key)
            self.redis.delete(cdxj_key)

    def commit_file(self, user, collection, storage,
                    filename, full_filename, obj_type,
                    update_key, update_prop=None, direct_delete=False):

        if not storage:
            return False

        full_filename = strip_prefix(full_filename)

        # not a local filename
        if '://' in full_filename and not full_filename.startswith('local'):
            return False

        if not os.path.isfile(full_filename):
            return False

        commit_wait = self.COMMIT_WAIT_TEMPL.format(filename=full_filename)

        if self.redis.set(commit_wait, 1, ex=self.COMMIT_WAIT_SECS, nx=True):
            if not storage.upload_file(user, collection, self,
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
             if self.redis.publish('handle_delete_file', full_filename) < 1:
                print('No Delete Listener!')

        return True

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
