import logging
import os
import traceback
from datetime import date

import gevent
from pywb.utils.loaders import load
from pywb.warcserver.index.cdxobject import CDXObject

from webrecorder.models.auto import Auto
from webrecorder.models.base import RedisNamedMap, RedisOrderedList, RedisUniqueComponent, RedisUnorderedList
from webrecorder.models.datshare import DatShare
from webrecorder.models.list_bookmarks import BookmarkList
from webrecorder.models.pages import PagesMixin
from webrecorder.models.recording import Recording
from webrecorder.rec.storage import get_storage as get_global_storage
from webrecorder.rec.storage.storagepaths import strip_prefix
from webrecorder.utils import get_new_id, sanitize_title

logger = logging.getLogger('wr.io')


# ============================================================================
class Collection(PagesMixin, RedisUniqueComponent):
    """Collection Redis building block.

    :cvar str RECS_KEY: recordings Redis key
    :cvar str LISTS_KEY: lists Redis key
    :cvar str LIST_NAMES_KEY: list names Redis key
    :cvar str LIST_REDIR_KEY: list redirect Redis key
    :cvar str COLL_CDXJ_KEY: CDX index file Redis key
    :cvar str CLOSE_WAIT_KEY: n.s.
    :cvar str COMMIT_WAIT_KEY: n.s.
    :cvar str INDEX_FILE_KEY: CDX index file
    :cvar int COMMIT_WAIT_SECS: wait for the given number of seconds
    :cvar str DEFAULT_COLL_DESC: default description
    :cvar str DEFAULT_STORE_TYPE: default Webrecorder storage
    :cvar int COLL_CDXJ_TTL: TTL of CDX index file
    :ivar RedisUnorderedList recs: recordings
    :ivar RedisOrderedList lists: n.s.
    :ivar RedisNamedMap list_names: n.s.
    """
    MY_TYPE = 'coll'
    INFO_KEY = 'c:{coll}:info'
    ALL_KEYS = 'c:{coll}:*'

    RECS_KEY = 'c:{coll}:recs'

    LISTS_KEY = 'c:{coll}:lists'
    LIST_NAMES_KEY = 'c:{coll}:ln'
    LIST_REDIR_KEY = 'c:{coll}:lr'

    AUTO_KEY = 'c:{coll}:autos'

    COLL_CDXJ_KEY = 'c:{coll}:cdxj'

    CLOSE_WAIT_KEY = 'c:{coll}:wait:{id}'

    EXTERNAL_KEY = 'c:{coll}:ext'

    COMMIT_WAIT_KEY = 'w:{filename}'

    INDEX_FILE_KEY = '@index_file'

    COMMIT_WAIT_SECS = 30

    DEFAULT_COLL_DESC = ''

    DEFAULT_STORE_TYPE = 'local'

    COLL_CDXJ_TTL = 1800

    def __init__(self, **kwargs):
        """Initialize collection Redis building block."""
        super(Collection, self).__init__(**kwargs)
        self.recs = RedisUnorderedList(self.RECS_KEY, self)
        self.lists = RedisOrderedList(self.LISTS_KEY, self)

        self.list_names = RedisNamedMap(self.LIST_NAMES_KEY, self, self.LIST_REDIR_KEY)
        self._storage = None
        self._warc_key = None  # type: str

    @classmethod
    def init_props(cls, config):
        """Initialize class variables.

        :param dict config: Webrecorder configuration
        """
        cls.COLL_CDXJ_TTL = int(config['coll_cdxj_ttl'])

        cls.DEFAULT_STORE_TYPE = os.environ.get('DEFAULT_STORAGE', 'local')

        cls.DEFAULT_COLL_DESC = config['coll_desc']

        cls.COMMIT_WAIT_SECS = int(config['commit_wait_secs'])

    def create_recording(self, **kwargs):
        """Create recording.

        :returns: recording
        :rtype: Recording
        """
        self.access.assert_can_admin_coll(self)

        recording = Recording(redis=self.redis,
                              access=self.access)

        rec = recording.init_new(**kwargs)

        self.recs.add_object(recording, owner=True)

        return recording

    def move_recording(self, obj, new_collection):
        """Move recording into new collection.

        :param Recording obj: recording
        :param new_collection: new collection

        :returns: name of new recording or None
        :rtype: str or None
        """
        new_recording = new_collection.create_recording()

        if new_recording.copy_data_from_recording(obj, delete_source=True):
            return new_recording.name

        return None

    def create_auto(self, props=None):
        self.access.assert_can_admin_coll(self)

        auto = Auto(redis=self.redis,
                    access=self.access)

        aid = auto.init_new(self, props)

        self.redis.sadd(self.AUTO_KEY.format(coll=self.my_id), aid)

        return aid

    def get_auto(self, aid):
        if not self.access.can_admin_coll(self):
            return None

        auto = Auto(my_id=aid,
                    redis=self.redis,
                    access=self.access)

        if auto['owner'] != self.my_id:
            return None

        auto.owner = self

        return auto

    def get_autos(self):
        return [self.get_auto(aid) for aid in self.redis.smembers(self.AUTO_KEY.format(coll=self.my_id))]

    def remove_auto(self, auto):
        self.access.assert_can_admin_coll(self)

        count = self.redis.srem(self.AUTO_KEY.format(coll=self.my_id))

        if not count:
            return False

        return auto.delete_me()

    def create_bookmark_list(self, props):
        """Create list of bookmarks.

        :param dict props: properties

        :returns: list of bookmarks
        :rtype: BookmarkList
        """
        self.access.assert_can_write_coll(self)

        bookmark_list = BookmarkList(redis=self.redis,
                                     access=self.access)

        bookmark_list.init_new(self, props)

        before_blist = self.get_list(props.get('before_id'))

        self.lists.insert_ordered_object(bookmark_list, before_blist)

        slug = self.get_list_slug(props.get('title'))
        if slug:
            self.list_names.add_object(slug, bookmark_list)

        return bookmark_list

    def get_lists(self, load=True, public_only=False):
        """Return lists of bookmarks.

        :param bool load: whether to load Redis entries
        :param bool public_only: whether only to load public lists

        :returns: lists of bookmarks
        :rtype: list
        """
        self.access.assert_can_read_coll(self)

        lists = self.lists.get_ordered_objects(BookmarkList, load=load)

        if public_only or not self.access.can_write_coll(self):
            lists = [blist for blist in lists if blist.is_public()]
            #lists = [blist for blist in lists if self.access.can_read_list(blist)]

        return lists

    def get_list_slug(self, title):
        """Return reserved field name.

        :param str title: title

        :returns: reserved field name
        :rtype: str
        """
        if not title:
            return

        slug = sanitize_title(title)
        if not slug:
            return

        return self.list_names.reserve_obj_name(slug, allow_dupe=True)

    def update_list_slug(self, new_title, bookmark_list):
        """Rename list field name.

        :param str new_title: new field name
        :param BookmarkList bookmark_list: list of bookmarks

        :returns: whether successful or not
        :rtype: bool or None
        """
        old_title = bookmark_list.get_prop('title')
        if old_title == new_title:
            return False

        new_slug = self.list_names.rename(bookmark_list, sanitize_title(new_title))
        return new_slug is not None

    def get_list(self, blist_id):
        """Return list of bookmarks.

        :param str blist_id: list ID

        :returns: list of bookmarks
        :rtype: BookmarkList or None
        """
        if not self.lists.contains_id(blist_id):
            return None

        bookmark_list = BookmarkList(my_id=blist_id,
                                     redis=self.redis,
                                     access=self.access)

        bookmark_list.owner = self

        if not self.access.can_read_list(bookmark_list):
            return None

        return bookmark_list

    def get_list_by_slug_or_id(self, slug_or_id):
        """Return list of bookmarks.

        :param str slug_or_id: either list ID or list title

        :returns: list of bookmarks
        :rtype: BookmarkList or None
        """
        # see if its a slug, otherwise treat as id
        blist_id = self.list_names.name_to_id(slug_or_id) or slug_or_id

        return self.get_list(blist_id)

    def move_list_before(self, blist, before_blist):
        """Move list of bookmarks in ordered list.

        :param str blist: list ID
        :param str before_blist: list ID
        """
        self.access.assert_can_write_coll(self)

        self.lists.insert_ordered_object(blist, before_blist)

    def remove_list(self, blist):
        """Remove list of bookmarks from ordered list.

        :param BookmarkList blist: list ID

        :returns: whether successful or not
        :rtype: bool
        """
        self.access.assert_can_write_coll(self)

        if not self.lists.remove_ordered_object(blist):
            return False

        self.list_names.remove_object(blist)

        blist.delete_me()

        return True

    def num_lists(self):
        """Return number of lists of bookmarks.

        :returns: number of lists
        :rtype: int
        """
        if self.access.assert_can_write_coll(self):
            return self.lists.num_ordered_objects()
        else:
            return len(self.get_lists())

    def init_new(self, slug, title, desc='', public=False, public_index=False):
        """Initialize new collection.

        :param str title: title
        :param str desc: description
        :param bool public: whether collection is public
        :param bool public_index: whether CDX index file is public

        :returns: collection
        :rtype: Collection
        """
        coll = self._create_new_id()

        key = self.INFO_KEY.format(coll=coll)

        self.data = {'title': title,
                     'size': 0,
                     'desc': desc,
                     'public': self._from_bool(public),
                     'public_index': self._from_bool(public_index),
                    }

        self._init_new()

        return coll

    def get_recording(self, rec):
        """Return recording.

        :param str rec: recording ID

        :returns: recording
        :rtype: Recording or None
        """
        if not self.recs.contains_id(rec):
            return None

        recording = Recording(my_id=rec,
                              name=rec,
                              redis=self.redis,
                              access=self.access)

        recording.owner = self
        return recording

    def num_recordings(self):
        """Return number of recordings.

        :returns: number of recordings
        :rtype: int
        """
        return self.recs.num_objects()

    def get_recordings(self, load=True):
        """Return recordings.

        :param bool load: whether to load Redis entries

        :returns: list of recordings
        :rtype: list
        """
        return self.recs.get_objects(Recording, load=load)

    def _get_rec_keys(self, key_templ):
        """Return recording Redis keys.

        :param str key_templ: Redis key template

        :returns: recording Redis keys
        :rtype: list
        """
        self.access.assert_can_read_coll(self)

        key_pattern = key_templ.format(rec='*')

        #comp_map = self.get_comp_map()

        #recs = self.redis.hvals(comp_map)
        recs = self.recs.get_keys()

        return [key_pattern.replace('*', rec) for rec in recs]

    def get_warc_key(self):
        """Returns the WARC key for this collection

        :return: This collections WARC key
        :rtype: str
        """
        if self._warc_key is None:
            self._warc_key = Recording.COLL_WARC_KEY.format(coll=self.my_id)
        return self._warc_key

    def get_warc_path(self, name):
        """Returns the full path or URL to the WARC for the supplied recording name

        :param str name: The recordings name
        :return: The full path or URL to the WARC
        :rtype: str
        """
        return self.redis.hget(self.get_warc_key(), name)

    def commit_all(self, commit_id=None):
        # see if pending commits have been finished
        if commit_id:
            commit_key = self.CLOSE_WAIT_KEY.format(coll=self.my_id, id=commit_id)
            open_rec_ids = self.redis.smembers(commit_key)
            still_waiting = False
            for rec_id in open_rec_ids:
                recording = self.get_recording(rec_id)
                if recording.is_fully_committed():
                    continue

                still_waiting = True

            if not still_waiting:
                self.redis.delete(commit_key)
                return None

            return commit_id

        open_recs = []

        for recording in self.get_recordings():
            if recording.is_open():
                recording.set_closed()
                recording.commit_to_storage()

            elif recording.is_fully_committed():
                continue

            open_recs.append(recording)

        if not open_recs:
            return None

        commit_id = get_new_id(5)
        commit_key = self.CLOSE_WAIT_KEY.format(coll=self.my_id, id=commit_id)
        open_keys = [recording.my_id for recording in open_recs]
        self.redis.sadd(commit_key, *open_keys)
        self.redis.expire(commit_key, 200)
        return commit_id

    def import_serialized(self, data, coll_dir):
        page_id_map = {}

        self.set_external(True)

        for rec_data in data['recordings']:
            # CREATE RECORDING
            recording = self.create_recording(title=data.get('title'),
                                              desc=data.get('desc'),
                                              rec_type=data.get('rec_type'),
                                              ra_list=data.get('ra'))

            # Files
            files = rec_data.get('files')

            # WARCS
            if files:
                for filename in files.get('warcs', []):
                    full_filename = os.path.join(coll_dir, 'warcs', filename)

                    rec_warc_key = recording.REC_WARC_KEY.format(rec=recording.my_id)
                    coll_warc_key = self.get_warc_key()

                    self.redis.hset(coll_warc_key, filename, full_filename)
                    self.redis.sadd(rec_warc_key, filename)

                # CDX
                index_files = files.get('indexes', [])
                if index_files:
                    index_filename = os.path.join(coll_dir, 'indexes', index_files[0])

                    with open(index_filename, 'rb') as fh:
                        self.add_cdxj(fh.read())

                    recording.set_prop(recording.INDEX_FILE_KEY, index_filename)

            # PAGES
            pages = rec_data.get('pages')
            if pages:
                page_id_map.update(self.import_pages(pages, recording))

            self.set_date_prop('created_at', rec_data)
            self.set_date_prop('recorded_at', rec_data, 'updated_at')
            self.set_date_prop('updated_at', rec_data)

        # props
        self.set_date_prop('created_at', data)
        self.set_date_prop('updated_at', data)

        # LISTS
        lists = data.get('lists')
        if not lists:
            return

        for list_data in lists:
            bookmarks = list_data.pop('bookmarks', [])
            list_data['public'] = True
            blist = self.create_bookmark_list(list_data)
            for bookmark_data in bookmarks:
                page_id = bookmark_data.get('page_id')
                if page_id:
                    bookmark_data['page_id'] = page_id_map.get(page_id)
                bookmark = blist.create_bookmark(bookmark_data, incr_stats=False)


    def serialize(self, include_recordings=True,
                        include_lists=True,
                        include_rec_pages=False,
                        include_pages=True,
                        include_bookmarks='first',
                        convert_date=True,
                        check_slug=False,
                        include_files=False):

        data = super(Collection, self).serialize(convert_date=convert_date)
        data['id'] = self.name

        if check_slug:
            data['slug_matched'] = (check_slug == data.get('slug'))

        is_owner = self.access.is_coll_owner(self)

        if include_recordings:
            recordings = self.get_recordings(load=True)
            rec_serialized = []

            duration = 0
            for recording in recordings:
                rec_data = recording.serialize(include_pages=include_rec_pages,
                                               include_files=include_files)
                rec_serialized.append(rec_data)
                duration += rec_data.get('duration', 0)

            if is_owner:
                data['recordings'] = rec_serialized

            data['duration'] = duration

        if include_lists:
            lists = self.get_lists(load=True, public_only=False)
            data['lists'] = [blist.serialize(include_bookmarks=include_bookmarks,
                                             convert_date=convert_date) for blist in lists]

        if not data.get('desc'):
            data['desc'] = self.DEFAULT_COLL_DESC.format(self.name)

        data['public'] = self.is_public()
        data['public_index'] = self.get_bool_prop('public_index', False)

        if DatShare.DAT_SHARE in data:
            data[DatShare.DAT_SHARE] = self.get_bool_prop(DatShare.DAT_SHARE, False)

        if DatShare.DAT_UPDATED_AT in data:
            data[DatShare.DAT_UPDATED_AT] = self.to_iso_date(data[DatShare.DAT_UPDATED_AT])

        if include_pages:
            if is_owner or data['public_index']:
                data['pages'] = self.list_pages()

        data.pop('num_downloads', '')

        return data

    def remove_recording(self, recording, delete=False):
        self.access.assert_can_admin_coll(self)

        if not recording:
            return {'error': 'no_recording'}

        if not self.recs.remove_object(recording):
            return {'error': 'not_found'}
        else:
            self.incr_size(-recording.size)

        size = recording.size
        user = self.get_owner()
        if user:
            user.incr_size(-recording.size)

        if delete:
            storage = self.get_storage()
            return recording.delete_me(storage)

        self.sync_coll_index(exists=True, do_async=True)
        return {}

    def delete_me(self):
        self.access.assert_can_admin_coll(self)

        storage = self.get_storage()

        errs = {}

        for recording in self.get_recordings(load=False):
            errs.update(recording.delete_me(storage, pages=False))

        for blist in self.get_lists(load=False):
            blist.delete_me()

        for auto in self.get_autos():
            if auto:
                auto.delete_me()

        if storage:
            if not storage.delete_collection(self):
                errs['error_delete_coll'] = 'not_found'

        if not self.delete_object():
            errs['error'] = 'not_found'

        if DatShare.dat_share:
            DatShare.dat_share.unshare(self)

        return errs

    def get_storage(self):
        if self._storage is not None:
            return self._storage
        storage_type = self.get_prop('storage_type')

        if not storage_type:
            storage_type = self.DEFAULT_STORE_TYPE

        self._storage = get_global_storage(storage_type, self.redis)
        return self._storage

    def get_created_iso_date(self):
        try:
            dt_str = date.fromtimestamp(int(self['created_at'])).isoformat()
        except:
            dt_str = self['created_at'][:10]

        return dt_str

    def get_dir_path(self):
        return self.get_created_iso_date() + '/' + self.my_id

    def add_cdxj(self, cdxj_text):
        if not self.is_external():
            return 0

        coll_cdxj_key = self.COLL_CDXJ_KEY.format(coll=self.my_id)
        count = 0

        for line in cdxj_text.split(b'\n'):
            if not line:
                continue

            try:
                cdx = CDXObject(line)
                self.redis.zadd(coll_cdxj_key, 0, str(cdx))
                count += 1
            except:
                pass

        return count

    def add_warcs(self, warc_map):
        if not self.is_external():
            return 0

        warc_key = self.get_warc_key()

        if warc_map:
            self.redis.hmset(warc_key, warc_map)

        return len(warc_map)

    def is_external(self):
        return self.get_bool_prop('external')

    def set_external(self, external):
        self.set_bool_prop('external', external)

    def set_external_remove_on_expire(self):
        key = self.EXTERNAL_KEY.format(coll=self.my_id)
        self.redis.set(key, '1')

    def commit_file(self, filename, full_filename, obj_type,
                    update_key=None, update_prop=None, direct_delete=False):

        user = self.get_owner()
        storage = self.get_storage()

        if not storage:
            logger.debug('Skip File Commit: No Storage')
            return True

        orig_full_filename = full_filename
        full_filename = strip_prefix(full_filename)

        # not a local filename
        if '://' in full_filename and not full_filename.startswith('local'):
            logger.debug('Skip File Commit: Not Local Filename: {0}'.format(full_filename))
            return True

        if not os.path.isfile(full_filename):
            logger.debug('Fail File Commit: Not Found: {0}'.format(full_filename))
            return False

        commit_wait = self.COMMIT_WAIT_KEY.format(filename=full_filename)

        if self.redis.set(commit_wait, '1', ex=self.COMMIT_WAIT_SECS, nx=True):
            if not storage.upload_file(user, self, None,
                                       filename, full_filename, obj_type):

                self.redis.delete(commit_wait)
                return False

        # already uploaded, see if it is accessible
        # if so, finalize and delete original
        remote_url = storage.get_upload_url(filename)
        if not remote_url:
            logger.debug('File Commit: Not Yet Available: {0}'.format(full_filename))
            return False

        if update_key:
            update_prop = update_prop or filename
            self.redis.hset(update_key, update_prop, remote_url)

        # just in case, if remote_url is actually same as original (local file double-commit?), just return
        if remote_url == orig_full_filename:
            logger.debug('File Already Committed: {0}'.format(remote_url))
            return True

        # if direct delete, call os.remove directly
        # used for CDXJ files which are not owned by a writer
        if direct_delete:
            try:
                os.remove(full_filename)
            except Exception as e:
                traceback.print_exc()
        else:
        # for WARCs, send handle_delete to ensure writer can close the file
             if self.redis.publish('handle_delete_file', full_filename) < 1:
                logger.debug('No Delete Listener!')

        logger.debug('File Committed {0} -> {1}'.format(full_filename, remote_url))
        return True

    def has_cdxj(self):
        coll_cdxj_key = self.COLL_CDXJ_KEY.format(coll=self.my_id)
        return self.redis.exists(coll_cdxj_key)

    def reset_cdxj_ttl(self, key=None):
        if not key:
            key = self.COLL_CDXJ_KEY.format(coll=self.my_id)
        if self.COLL_CDXJ_TTL > 0:
            self.redis.expire(key, self.COLL_CDXJ_TTL)
            return True
        return False

    def sync_coll_index(self, exists=False, do_async=False):
        coll_cdxj_key = self.COLL_CDXJ_KEY.format(coll=self.my_id)
        if exists != self.redis.exists(coll_cdxj_key):
            self.reset_cdxj_ttl(coll_cdxj_key)
            return

        cdxj_keys = self._get_rec_keys(Recording.CDXJ_KEY)
        if not cdxj_keys:
            return

        self.redis.zunionstore(coll_cdxj_key, cdxj_keys)
        self.reset_cdxj_ttl(coll_cdxj_key)

        ges = []
        for cdxj_key in cdxj_keys:
            if self.redis.exists(cdxj_key):
                continue

            ges.append(gevent.spawn(self._do_download_cdxj, cdxj_key, coll_cdxj_key))

        if not do_async:
            res = gevent.joinall(ges)

    def _do_download_cdxj(self, cdxj_key, output_key):
        lock_key = None
        try:
            rec_info_key = cdxj_key.rsplit(':', 1)[0] + ':info'
            cdxj_filename = self.redis.hget(rec_info_key, self.INDEX_FILE_KEY)
            if not cdxj_filename:
                logger.debug('CDX Sync: No index for ' + rec_info_key)
                return

            lock_key = cdxj_key + ':_'
            logger.debug('CDX Sync: Downloading for {0} file {1}'.format(rec_info_key, cdxj_filename))
            attempts = 0

            if not self.redis.set(lock_key, 1, ex=self.COMMIT_WAIT_SECS, nx=True):
                logger.warning('CDX Sync: Already downloading, skipping: {0}'.format(cdxj_filename))
                lock_key = None
                return

            while attempts < 10:
                fh = None
                try:
                    fh = load(cdxj_filename)
                    buff = fh.read()

                    for cdxj_line in buff.splitlines():
                        self.redis.zadd(output_key, 0, cdxj_line)

                    break
                except Exception as e:
                    traceback.print_exc()
                    logger.error('CDX Sync: Could not load: ' + cdxj_filename)
                    attempts += 1

                finally:
                    if fh:
                        fh.close()

            self.reset_cdxj_ttl(output_key)

        except Exception as e:
            logger.error('CDX Sync: Error downloading cache: ' + str(e))
            traceback.print_exc()

        finally:
            if lock_key:
                self.redis.delete(lock_key)


# ============================================================================
Recording.OWNER_CLS = Collection
BookmarkList.OWNER_CLS = Collection
Auto.OWNER_CLS = Collection
