import gevent
import logging
import json
import hashlib
import os

from datetime import date

from pywb.utils.loaders import load
from warcio.timeutils import timestamp20_now

from pywb.warcserver.index.cdxobject import CDXObject

from webrecorder.utils import sanitize_title
from webrecorder.models.base import RedisUnorderedList, RedisOrderedList, RedisUniqueComponent, RedisNamedMap
from webrecorder.models.recording import Recording
from webrecorder.models.pages import PagesMixin
from webrecorder.models.datshare import DatShare
from webrecorder.models.list_bookmarks import BookmarkList
from webrecorder.rec.storage import get_storage as get_global_storage


# ============================================================================
class Collection(PagesMixin, RedisUniqueComponent):
    MY_TYPE = 'coll'
    INFO_KEY = 'c:{coll}:info'
    ALL_KEYS = 'c:{coll}:*'

    RECS_KEY = 'c:{coll}:recs'

    LISTS_KEY = 'c:{coll}:lists'
    LIST_NAMES_KEY = 'c:{coll}:ln'
    LIST_REDIR_KEY = 'c:{coll}:lr'

    COLL_CDXJ_KEY = 'c:{coll}:cdxj'

    INDEX_FILE_KEY = '@index_file'

    DEFAULT_COLL_DESC = ''

    DEFAULT_STORE_TYPE = 'local'

    COLL_CDXJ_TTL = 1800

    DAT_PROP = 'dat_key'
    DAT_COMMITTED_AT = 'dat_committed_at'
    DAT_COLLS = 's:dat_colls'

    def __init__(self, **kwargs):
        super(Collection, self).__init__(**kwargs)
        self.recs = RedisUnorderedList(self.RECS_KEY, self)
        self.lists = RedisOrderedList(self.LISTS_KEY, self)

        self.list_names = RedisNamedMap(self.LIST_NAMES_KEY, self, self.LIST_REDIR_KEY)

    @classmethod
    def init_props(cls, config):
        cls.COLL_CDXJ_TTL = config['coll_cdxj_ttl']

        cls.DEFAULT_STORE_TYPE = os.environ.get('DEFAULT_STORAGE', 'local')

        cls.DEFAULT_COLL_DESC = config['coll_desc']

    def create_recording(self, **kwargs):
        self.access.assert_can_admin_coll(self)

        recording = Recording(redis=self.redis,
                              access=self.access)

        rec = recording.init_new(**kwargs)

        self.recs.add_object(recording, owner=True)

        return recording

    def move_recording(self, obj, new_collection):
        new_recording = new_collection.create_recording()

        if new_recording.copy_data_from_recording(obj, delete_source=True):
            return new_recording.name

        return None

    def create_bookmark_list(self, props):
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
        self.access.assert_can_read_coll(self)

        lists = self.lists.get_ordered_objects(BookmarkList, load=load)

        if public_only or not self.access.can_write_coll(self):
            lists = [blist for blist in lists if blist.is_public()]
            #lists = [blist for blist in lists if self.access.can_read_list(blist)]

        return lists

    def get_list_slug(self, title):
        if not title:
            return

        slug = sanitize_title(title)
        if not slug:
            return

        return self.list_names.reserve_obj_name(slug, allow_dupe=True)

    def update_list_slug(self, new_title, bookmark_list):
        old_title = bookmark_list.get_prop('title')
        if old_title == new_title:
            return False

        new_slug = self.list_names.rename(bookmark_list, sanitize_title(new_title))
        return new_slug is not None

    def get_list(self, blist_id):
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
        # see if its a slug, otherwise treat as id
        blist_id = self.list_names.name_to_id(slug_or_id) or slug_or_id

        return self.get_list(blist_id)

    def move_list_before(self, blist, before_blist):
        self.access.assert_can_write_coll(self)

        self.lists.insert_ordered_object(blist, before_blist)

    def remove_list(self, blist):
        self.access.assert_can_write_coll(self)

        if not self.lists.remove_ordered_object(blist):
            return False

        self.list_names.remove_object(blist)

        blist.delete_me()

        return True

    def num_lists(self):
        if self.access.assert_can_write_coll(self):
            return self.lists.num_ordered_objects()
        else:
            return len(self.get_lists())

    def init_new(self, slug, title, desc='', public=False):
        coll = self._create_new_id()

        key = self.INFO_KEY.format(coll=coll)

        self.data = {'title': title,
                     'size': 0,
                     'desc': desc,
                     'public': self._from_bool(public),
                     'public_index': False,
                    }

        self._init_new()

        return coll

    def get_recording(self, rec):
        if not self.recs.contains_id(rec):
            return None

        recording = Recording(my_id=rec,
                              name=rec,
                              redis=self.redis,
                              access=self.access)

        recording.owner = self
        return recording

    def num_recordings(self):
        return self.recs.num_objects()

    def get_recordings(self, load=True):
        return self.recs.get_objects(Recording, load=load)

    def _get_rec_keys(self, key_templ):
        self.access.assert_can_read_coll(self)

        key_pattern = key_templ.format(rec='*')

        #comp_map = self.get_comp_map()

        #recs = self.redis.hvals(comp_map)
        recs = self.recs.get_keys()

        return [key_pattern.replace('*', rec) for rec in recs]

    def serialize(self, include_recordings=True,
                        include_lists=True,
                        include_rec_pages=False,
                        include_pages=True,
                        include_bookmarks='first',
                        convert_date=True,
                        check_slug=False):

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
                rec_data = recording.serialize(include_pages=include_rec_pages)
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

        if include_pages:
            if is_owner or data['public_index']:
                data['pages'] = self.list_pages()

        if not is_owner:
            self.data.pop('downloads', '')

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

        if storage:
            if not storage.delete_collection(self):
                errs['error_delete_coll'] = 'not_found'

        if not self.delete_object():
            errs['error'] = 'not_found'

        self.dat_unshare(remove=True)

        return errs

    def get_storage(self):
        storage_type = self.get_prop('storage_type')

        if not storage_type:
            storage_type = self.DEFAULT_STORE_TYPE

        return get_global_storage(storage_type, self.redis)

    def get_created_iso_date(self):
        return date.fromtimestamp(int(self['created_at'])).isoformat()

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

        #self.redis.expire(coll_cdxj_key, self.COLL_CDXJ_TTL)
        return count

    def add_warcs(self, warc_map):
        if not self.is_external():
            return 0

        warc_key = Recording.COLL_WARC_KEY.format(coll=self.my_id)

        if warc_map:
            self.redis.hmset(warc_key, warc_map)

        return len(warc_map)

    def is_external(self):
        return self.get_bool_prop('external')

    def set_external(self, external):
        self.set_bool_prop('external', external)

    def dat_share(self, dat_key):
        self.set_prop(self.DAT_PROP, dat_key)
        self.set_prop(self.DAT_COMMITTED_AT, self._get_now())

        self.redis.sadd(self.DAT_COLLS, self.my_id)

    def dat_unshare(self, remove=False):
        dat_key = self.get_prop(self.DAT_PROP)

        if dat_key:
            self.redis.srem(self.DAT_COLLS, self.my_id)
            self.set_prop(self.DAT_PROP, '')

            # TODO: better way to ensure dat removal?
            if remove:
                DatShare().remove_only(self)

    def sync_coll_index(self, exists=False, do_async=False):
        coll_cdxj_key = self.COLL_CDXJ_KEY.format(coll=self.my_id)
        if exists != self.redis.exists(coll_cdxj_key):
            self.redis.expire(coll_cdxj_key, self.COLL_CDXJ_TTL)
            return

        cdxj_keys = self._get_rec_keys(Recording.CDXJ_KEY)
        if not cdxj_keys:
            return

        self.redis.zunionstore(coll_cdxj_key, cdxj_keys)
        self.redis.expire(coll_cdxj_key, self.COLL_CDXJ_TTL)

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
                logging.debug('No index for ' + rec_info_key)
                return

            lock_key = cdxj_key + ':_'
            logging.debug('Downloading for {0} file {1}'.format(rec_info_key, cdxj_filename))
            attempts = 0

            if not self.redis.set(lock_key, 1, nx=True):
                logging.warning('Already downloading, skipping')
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
                    import traceback
                    traceback.print_exc()
                    logging.error('Could not load: ' + cdxj_filename)
                    attempts += 1

                finally:
                    if fh:
                        fh.close()

            self.redis.expire(output_key, self.COLL_CDXJ_TTL)

        except Exception as e:
            logging.error('Error downloading cache: ' + str(e))
            import traceback
            traceback.print_exc()

        finally:
            if lock_key:
                self.redis.delete(lock_key)


# ============================================================================
Recording.OWNER_CLS = Collection
BookmarkList.OWNER_CLS = Collection

