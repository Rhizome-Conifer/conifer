import gevent
import logging
import json

from pywb.utils.loaders import load
from warcio.timeutils import timestamp20_now

from webrecorder.utils import redis_pipeline

from webrecorder.models.base import RedisNamedContainer, RedisOrderedListMixin
from webrecorder.models.recording import Recording
from webrecorder.models.list_bookmarks import BookmarkList


# ============================================================================
class Collection(RedisOrderedListMixin, RedisNamedContainer):
    MY_TYPE = 'coll'
    INFO_KEY = 'c:{coll}:info'
    ALL_KEYS = 'c:{coll}:*'

    COUNTER_KEY = 'n:colls:count'

    COMP_KEY = 'c:{coll}:recs'

    ORDERED_LIST_KEY = 'c:{coll}:lists'

    COLL_CDXJ_KEY = 'c:{coll}:cdxj'
    COLL_CDXJ_TTL = 1800

    INDEX_FILE_KEY = '@index_file'

    PUBLIC_FLAG = 'r:@public'

    @classmethod
    def init_props(cls, config):
        cls.COLL_CDXJ_TTL = config['coll_cdxj_ttl']
        cls.INDEX_FILE_KEY = config['info_index_key']

    def create_recording(self, rec_name='', **kwargs):
        self.access.assert_can_admin_coll(self)

        if not rec_name:
            rec_name = self._new_rec_name()

        rec_name = self.reserve_obj_name(rec_name, allow_dupe=True)

        recording = Recording(redis=self.redis,
                              access=self.access)

        rec = recording.init_new(**kwargs)
        self.add_object(rec_name, recording, owner=True)

        return recording

    def create_bookmark_list(self, props):
        self.access.assert_can_write_coll(self)

        bookmark_list = BookmarkList(redis=self.redis,
                                     access=self.access)

        bookmark_list.init_new(self, props)

        before_blist = self.get_list(props.get('before_id'))

        self.insert_ordered_object(bookmark_list, before_blist)

        return bookmark_list

    def get_lists(self, load=True):
        self.access.assert_can_read_coll(self)

        lists = self.get_ordered_objects(BookmarkList, load=load)

        if not self.access.can_write_coll(self):
            lists = [blist for blist in lists if self.access.can_read_list(blist)]

        return lists

    def get_list(self, blist_id):
        if not self.contains_id(blist_id):
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

        self.insert_ordered_object(blist, before_blist)

    def remove_list(self, blist):
        self.access.assert_can_write_coll(self)

        if not self.remove_ordered_object(blist):
            return False

        blist.delete_me()

        return True

    def num_lists(self):
        if self.access.assert_can_write_coll(self):
            return self.num_ordered_objects()
        else:
            return len(list(self.get_lists()))

    def _new_rec_name(self):
        return 'rec-' + timestamp20_now()

    def init_new(self, title, desc='', public=False):
        coll = self._create_new_id()

        key = self.INFO_KEY.format(coll=coll)

        self.data = {'title': title,
                     'size': 0,
                     'desc': desc,
                    }

        if public:
            #TODO: standardize prop?
            self.data[self.PUBLIC_FLAG] = '1'

        self._init_new()

        return coll

    def get_recording_by_name(self, rec_name):
        rec = self.name_to_id(rec_name)

        return self.get_recording_by_id(rec, rec_name)

    def get_recording_by_id(self, rec, rec_name):
        if not rec or rec == '*':
            return None

        recording = Recording(my_id=rec,
                              name=rec_name,
                              redis=self.redis,
                              access=self.access)

        recording.owner = self
        return recording

    def num_recordings(self):
        return self.num_objects()

    def get_recordings(self, load=True):
        recordings = self.get_objects(Recording)
        for recording in recordings:
            recording.owner = self
            if load:
                recording.load()

        return recordings

    def _get_rec_keys(self, key_templ):
        self.access.assert_can_read_coll(self)

        key_pattern = key_templ.format(rec='*')

        comp_map = self.get_comp_map()

        recs = self.redis.hvals(comp_map)

        return [key_pattern.replace('*', rec) for rec in recs]

    def count_pages(self):
        self.access.assert_can_read_coll(self)

        all_page_keys = self._get_rec_keys(Recording.PAGE_KEY)

        count = 0

        for key in all_page_keys:
            count += self.redis.hlen(key)

        return count

    def list_coll_pages(self):
        all_page_keys = self._get_rec_keys(Recording.PAGE_KEY)

        pagelist = []

        pi = self.redis.pipeline(transaction=False)
        for key in all_page_keys:
            pi.hvals(key)

        all_pages = pi.execute()

        for key, rec_pagelist in zip(all_page_keys, all_pages):
            rec = key.rsplit(':', 2)[-2]
            for page in rec_pagelist:
                page = json.loads(page)
                #page['user'] = user
                #page['collection'] = coll
                #page['recording'] = rec
                pagelist.append(page)

        if not self.access.can_admin_coll(self):
            pagelist = [page for page in pagelist if page.get('hidden') != '1']

        return sorted(pagelist, key=lambda x: x['timestamp'])

    def serialize(self, include_recordings=True, include_lists=True):
        data = super(Collection, self).serialize()

        if include_recordings:
            recordings = self.get_recordings(load=True)
            data['recordings'] = [recording.serialize() for recording in recordings]

        if include_lists:
            lists = self.get_lists(load=True)
            data['lists'] = [blist.serialize(include_bookmarks=False) for blist in lists]

        return data

    def rename(self, obj, new_name, new_cont=None, allow_dupe=False):
        res = super(Collection, self).rename(obj, new_name, new_cont, allow_dupe=allow_dupe)
        if res and new_cont and new_cont != self:
            self.sync_coll_index(exists=True, do_async=True)
            new_cont.sync_coll_index(exists=True, do_async=True)

        return res

    def remove_recording(self, recording, user, delete=False, many=False):
        self.access.assert_can_admin_coll(self)

        if not recording:
            return False

        #if not many:
        #    self.assert_can_admin(user, coll)

        if not self.remove_object(recording):
            return False

        size = recording.size
        if user:
            user.incr_size(-recording.size)

        if delete:
            return recording.delete_me()

        #if not many:
        #    self.sync_coll_index(user, coll, exists=True, do_async=True)
        return True

    def delete_me(self):
        self.access.assert_can_admin_coll(self)

        all_objs = self.redis.hgetall(self.get_comp_map())

        for recording in self.get_recordings(load=False):
            recording.delete_me()

        for blist in self.get_lists(load=False):
            blist.delete_me()

        return self.delete_object()

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
            rec_warc_key = cdxj_key.rsplit(':', 1)[0] + ':warc'
            cdxj_filename = self.redis.hget(rec_warc_key, self.INDEX_FILE_KEY)
            if not cdxj_filename:
                logging.debug('No index for ' + rec_warc_key)
                return

            lock_key = cdxj_key + ':_'
            logging.debug('Downloading for {0} file {1}'.format(rec_warc_key, cdxj_filename))
            attempts = 0

            if not self.redis.set(lock_key, 1, nx=True):
                logging.warning('Already downloading, skipping')
                lock_key = None
                return

            while attempts < 10:
                try:
                    fh = load(cdxj_filename)
                    buff = fh.read()

                    for cdxj_line in buff.splitlines():
                        self.redis.zadd(output_key, 0, cdxj_line)

                    break
                except:
                    logging.error('Could not load: ' + cdxj_filename)
                    attempts += 1

                finally:
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

