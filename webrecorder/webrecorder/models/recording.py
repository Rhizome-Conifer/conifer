import json
import hashlib
import os
import base64
import shutil
import traceback
import logging

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

logger = logging.getLogger('wr.io')



# ============================================================================
class Recording(RedisUniqueComponent):
    """Recording Redis building block.

    :cvar str MY_TYPE: type of building block
    :cvar str INFO_KEY: building block information Redis key
    :cvar str ALL_KEYS: building block key pattern Redis key
    :cvar str OPEN_REC_KEY: ongoing recording Redis key
    :cvar str CDX: CDX index Redis key
    :cvar str RA_KEY: remote archives Redis key
    :cvar str PENDING_SIZE_KEY: outstanding size Redis key
    :cvar str PENDING_COUNT_KEY: outstanding CDX index lines Redis key
    :cvar int PENDING_TTL: outstanding TTL Redis key
    :cvar int COMMIT_WAIT_SECS: wait for the given number of seconds
    :cvar str REC_WARC_KEY: WARC Redis key (recording)
    :cvar str COLL_WARC_KEY: WARC Redis key (collection)
    :cvar str COMMIT_LOCK_KEY: storage lock Redis key
    :cvar str INDEX_FILE_KEY: CDX index file
    :cvar str INDEX_NAME_TEMPL: CDX index filename template
    :cvar str DELETE_RETRY: delete/retry Redis key
    :cvar int OPEN_REC_TTL: TTL ongoing recording
    """
    MY_TYPE = 'rec'
    INFO_KEY = 'r:{rec}:info'
    ALL_KEYS = 'r:{rec}:*'

    OPEN_REC_KEY = 'r:{rec}:open'

    CDXJ_KEY = 'r:{rec}:cdxj'

    RA_KEY = 'r:{rec}:ra'

    PENDING_SIZE_KEY = 'r:{rec}:_ps'
    PENDING_COUNT_KEY = 'r:{rec}:_pc'
    PENDING_TTL = 90

    COMMIT_WAIT_SECS = 30

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
        """Initialize class variables.

        :param dict config: Webrecorder configuration
        """
        cls.OPEN_REC_TTL = int(config['open_rec_ttl'])
        #cls.INDEX_FILE_KEY = config['info_index_key']

        cls.CDXJ_KEY = config.get('cdxj_key_templ', cls.CDXJ_KEY)
        #cls.INDEX_NAME_TEMPL = config['index_name_templ']

        #cls.COMMIT_WAIT_TEMPL = config['commit_wait_templ']
        cls.COMMIT_WAIT_SECS = int(config['commit_wait_secs'])

    @property
    def name(self):
        """Read-only attribute name."""
        return self.my_id

    def init_new(self, title='', desc='', rec_type=None, ra_list=None):
        """Initialize new recording Redis building block.

        :param str title: title
        :param str desc: description
        :param rec_type: type of recording
        :type: str or None
        :param ra_list: remote archives
        :type: list or None

        :returns: component ID
        :rtype: str
        """
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
        """Return whether the recording is ongoing. Optionally extend
        TTL of recording.

        :param bool extend: whether to extend TTL of recording

        :returns: whether recording is ongoing
        :rtype: bool
        """
        open_rec_key = self.OPEN_REC_KEY.format(rec=self.my_id)
        if extend:
            return self.redis.expire(open_rec_key, self.OPEN_REC_TTL)
        else:
            return self.redis.exists(open_rec_key)

    def set_closed(self):
        """Close recording."""
        open_rec_key = self.OPEN_REC_KEY.format(rec=self.my_id)
        self.redis.delete(open_rec_key)

    def is_fully_committed(self):
        """Return whether the CDX index file has been fully committed
        to storage.

        :returns: whether the CDX index file is fully committed
        :rtype: bool
        """
        if self.get_pending_count() > 0:
            return False

        cdxj_key = self.CDXJ_KEY.format(rec=self.my_id)
        return self.redis.exists(cdxj_key) == False

    def get_pending_count(self):
        """Return outstanding CDX index lines.

        :returns: outstanding CDX index lines
        :rtype: int
        """
        pending_count = self.PENDING_COUNT_KEY.format(rec=self.my_id)
        return int(self.redis.get(pending_count) or 0)

    def get_pending_size(self):
        """Return outstanding size.

        :returns: outstanding size
        :rtype: int
        """
        pending_size = self.PENDING_SIZE_KEY.format(rec=self.my_id)
        return int(self.redis.get(pending_size) or 0)

    def inc_pending_count(self):
        """Increase outstanding CDX index lines."""
        if not self.is_open(extend=False):
            return

        pending_count = self.PENDING_COUNT_KEY.format(rec=self.my_id)

        with redis_pipeline(self.redis) as pi:
            pi.incrby(pending_count, 1)
            pi.expire(pending_count, self.PENDING_TTL)

    def inc_pending_size(self, size):
        """Increase outstanding size.

        :param int size: size
        """
        if not self.is_open(extend=False):
            return

        pending_size = self.PENDING_SIZE_KEY.format(rec=self.my_id)
        with redis_pipeline(self.redis) as pi:
            pi.incrby(pending_size, size)
            pi.expire(pending_size, self.PENDING_TTL)

    def dec_pending_count_and_size(self, size):
        """Decrease outstanding CDX index lines and size.

        :param int size: size
        """
        # return if rec no longer exists (deleted while transfer is pending)
        if not self.redis.exists(self.info_key):
            return

        pending_count = self.PENDING_COUNT_KEY.format(rec=self.my_id)

        pending_size = self.PENDING_SIZE_KEY.format(rec=self.my_id)

        with redis_pipeline(self.redis) as pi:
            pi.incrby(pending_count, -1)
            pi.incrby(pending_size, -size)
            pi.expire(pending_count, self.PENDING_TTL)
            pi.expire(pending_size, self.PENDING_TTL)

    def serialize(self,
                  include_pages=False,
                  convert_date=True,
                  export_filter=False,
                  include_files=False):
        """Serialize Redis entries.

        :param bool include_pages: whether to include pages
        :param bool convert_date: whether to convert date
        :param bool include_files: whether to include
        WARC and CDX index file filenames
        """

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
        """Delete recording.

        :param BaseStorage storage: Webrecorder storage
        :param bool pages: whether to delete pages

        :returns: result
        :rtype: dict
        """
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
        """Return WARC Redis key (collection).

        :returns: Redis key
        :rtype: str
        """
        return self.COLL_WARC_KEY.format(coll=self.get_prop('owner'))

    def iter_all_files(self, include_index=False):
        """Return filenames (generator).

        :param bool include_index: whether to include index files

        :returns: Redis key and filename
        :rtype: str and str
        """
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
        """Delete files (WARC and CDX index files).

        :param BaseStorage storage: Webrecorder storage

        :returns: result
        :rtype: dict
        """
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
        """Add remote archive.

        :param StrictRedis pi: Redis interface (pipeline)
        :param str source_id: remote archive ID
        """
        ra_key = self.RA_KEY.format(rec=self.my_id)
        pi.sadd(ra_key, source_id)

    def set_patch_recording(self, patch_recording, update_ts=True):
        """Set recording patch.

        :param RedisUniqueComponent patch_recording: recording building block
        :param bool update_ts: whether to update timestamp
        """
        if patch_recording:
            self.set_prop('patch_rec', patch_recording.my_id, update_ts=update_ts)

    def get_patch_recording(self):
        """Get recording patch.

        :returns: recording patch
        :rtype: RedisUniqueComponent
        """
        patch_rec = self.get_prop('patch_rec')
        if patch_rec:
            return self.get_owner().get_recording(patch_rec)

    def write_cdxj(self, user, cdxj_key):
        """Write CDX index lines to file.

        :param RedisUniqueComponent user: user
        :param str cdxj_key: CDX index file Redis key

        :returns: CDX file filename and path
        :rtype: str and str
        """
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
        """Commit WARCs and CDX files to storage.

        :param storage: Webrecorder storage
        :type: BaseStorage or None
        """
        commit_lock = self.COMMIT_LOCK_KEY.format(rec=self.my_id)
        if not self.redis.set(commit_lock, '1', ex=self.COMMIT_WAIT_SECS, nx=True):
            logger.debug('Skipping, Already Committing Rec: {0}'.format(self.my_id))
            return

        try:
            logger.debug('Committing Rec: {0}'.format(self.my_id))
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
                logger.debug('Commit Done, Deleting Rec CDXJ: ' + cdxj_key)
                self.redis.delete(cdxj_key)

        finally:
            self.redis.delete(commit_lock)

    def _copy_prop(self, source, name):
        """Copy attribute value from given building block.

        :param RedisUniqueComponent source: Redis building block
        :param str name: attribute name
        """
        prop = source.get_prop(name)
        if prop:
            self.set_prop(name, prop)

    def copy_data_from_recording(self, source, delete_source=False):
        """Copy given recording building block entries.

        :param RedisUniqueComponent source: building block
        :param bool delete_source: whether to delete source building block

        :returns: whether successful or not
        :rtype: bool
        """
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
                    logger.debug('Copying {0} -> {1}'.format(url, target_file))
                    shutil.copyfileobj(src, dest)
                    size = dest.tell()

                if n != self.INDEX_FILE_KEY:
                    self.incr_size(size)
                    self.redis.hset(target_warc_key, n, add_local_store_prefix(target_file))
                else:
                    self.set_prop(n, target_file)

            except:
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
