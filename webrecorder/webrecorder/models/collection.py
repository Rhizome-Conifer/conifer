import gevent
import logging
import json
import hashlib
import os

from datetime import date

from pywb.utils.loaders import load
from warcio.timeutils import timestamp20_now

from webrecorder.models.base import RedisUnorderedList, RedisOrderedList, RedisUniqueComponent
from webrecorder.models.recording import Recording
from webrecorder.models.list_bookmarks import BookmarkList
from webrecorder.rec.storage import get_storage as get_global_storage


# ============================================================================
class Collection(RedisUniqueComponent):
    MY_TYPE = 'coll'
    INFO_KEY = 'c:{coll}:info'
    ALL_KEYS = 'c:{coll}:*'

    UNORDERED_RECS_KEY = 'c:{coll}:recs'

    ORDERED_LIST_KEY = 'c:{coll}:lists'

    COLL_CDXJ_KEY = 'c:{coll}:cdxj'

    INDEX_FILE_KEY = '@index_file'

    DEFAULT_STORE_TYPE = 'local'

    COLL_CDXJ_TTL = 1800

    def __init__(self, **kwargs):
        super(Collection, self).__init__(**kwargs)
        self.recs = RedisUnorderedList(self.UNORDERED_RECS_KEY, self)
        self.lists = RedisOrderedList(self.ORDERED_LIST_KEY, self)

    @classmethod
    def init_props(cls, config):
        cls.COLL_CDXJ_TTL = config['coll_cdxj_ttl']

        cls.DEFAULT_STORE_TYPE = os.environ.get('DEFAULT_STORAGE', 'local')

    def create_recording(self, **kwargs):
        self.access.assert_can_admin_coll(self)

        recording = Recording(redis=self.redis,
                              access=self.access)

        rec = recording.init_new(**kwargs)

        recording.name = recording.my_id

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

        return bookmark_list

    def get_lists(self, load=True, public_only=False):
        self.access.assert_can_read_coll(self)

        lists = self.lists.get_ordered_objects(BookmarkList, load=load)

        if public_only or not self.access.can_write_coll(self):
            lists = [blist for blist in lists if blist.is_public()]
            #lists = [blist for blist in lists if self.access.can_read_list(blist)]

        return lists

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

    def move_list_before(self, blist, before_blist):
        self.access.assert_can_write_coll(self)

        self.lists.insert_ordered_object(blist, before_blist)

    def remove_list(self, blist):
        self.access.assert_can_write_coll(self)

        if not self.lists.remove_ordered_object(blist):
            return False

        blist.delete_me()

        return True

    def num_lists(self):
        if self.access.assert_can_write_coll(self):
            return self.lists.num_ordered_objects()
        else:
            return len(self.get_lists())

    def init_new(self, title, desc='', public=False):
        coll = self._create_new_id()

        key = self.INFO_KEY.format(coll=coll)

        self.data = {'title': title,
                     'size': 0,
                     'desc': desc,
                     'public': self._from_bool(public),
                     'public_index': True,
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
        recordings = self.recs.get_objects(Recording)
        for recording in recordings:
            recording.owner = self
            if load:
                recording.load()

        return recordings

    def _get_rec_keys(self, key_templ):
        self.access.assert_can_read_coll(self)

        key_pattern = key_templ.format(rec='*')

        #comp_map = self.get_comp_map()

        #recs = self.redis.hvals(comp_map)
        recs = self.recs.get_keys()

        return [key_pattern.replace('*', rec) for rec in recs]

    def count_pages(self):
        self.access.assert_can_read_coll(self)

        all_page_keys = self._get_rec_keys(Recording.PAGE_KEY)

        count = 0

        for key in all_page_keys:
            count += self.redis.hlen(key)

        return count

    def list_coll_pages(self):
        #all_page_keys = self._get_rec_keys(Recording.PAGE_KEY)
        #all_objs = self.redis.hgetall(self.get_comp_map())
        all_objs = self.recs.get_keys()
        all_page_keys = [Recording.PAGE_KEY.format(rec=rec) for rec in all_objs]

        pagelist = []

        pi = self.redis.pipeline(transaction=False)
        for key in all_page_keys:
            pi.hvals(key)

        all_pages = pi.execute()

        for rec, rec_pagelist in zip(all_objs, all_pages):
            for page in rec_pagelist:
                page = json.loads(page)

                bk_attrs = (page['url'] + page['timestamp']).encode('utf-8')
                page['id'] = hashlib.md5(bk_attrs).hexdigest()[:10]
                page['recording'] = rec
                pagelist.append(page)

        if not self.access.can_admin_coll(self):
            pagelist = [page for page in pagelist if page.get('hidden') != '1']

        return sorted(pagelist, key=lambda x: x['timestamp'])

    def serialize(self, include_recordings=True, include_lists=True):
        data = super(Collection, self).serialize()
        self.data['id'] = self.name

        if include_recordings:
            recordings = self.get_recordings(load=True)
            rec_serialized = []

            duration = 0
            for recording in recordings:
                rec_data = recording.serialize()
                rec_serialized.append(rec_data)
                duration += rec_data.get('duration', 0)

            data['recordings'] = rec_serialized

            data['duration'] = duration

        if include_lists:
            lists = self.get_lists(load=True, public_only=False)
            data['lists'] = [blist.serialize(include_bookmarks='first') for blist in lists]

        data['public'] = self.is_public()
        data['public_index'] = self.get_bool_prop('public_index', True)
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
            errs.update(recording.delete_me(storage))

        for blist in self.get_lists(load=False):
            blist.delete_me()

        if storage:
            if not storage.delete_collection(self):
                errs['error_delete_coll'] = 'not_found'

        if not self.delete_object():
            errs['error'] = 'not_found'

        return errs

    def get_storage(self):
        storage_type = self.get_prop('storage_type')

        if not storage_type:
            storage_type = self.DEFAULT_STORE_TYPE

        return get_global_storage(storage_type, self.redis)

    def get_dir_path(self):
        return date.fromtimestamp(int(self['created_at'])).isoformat() + '/' + self.my_id

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

