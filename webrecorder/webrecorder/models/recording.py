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
from webrecorder.models.base import RedisUniqueComponent

from warcio.timeutils import timestamp_now, sec_to_timestamp, timestamp20_now


# ============================================================================
class Recording(RedisUniqueComponent):
    MY_TYPE = 'rec'
    INFO_KEY = 'r:{rec}:info'
    ALL_KEYS = 'r:{rec}:*'

    COUNTER_KEY = 'n:recs:count'

    OPEN_REC_KEY = 'r:{rec}:open'

    PAGE_KEY = 'r:{rec}:page'
    CDXJ_KEY = 'r:{rec}:cdxj'

    RA_KEY = 'r:{rec}:ra'

    WARC_KEY = 'r:{rec}:warc'

    DEL_Q = 'q:del:{target}'
    MOVE_Q = 'q:move:{target}'
    COPY_Q = 'q:copy'

    INDEX_FILE_KEY = '@index_file'

    COMMIT_WAIT_TEMPL = 'w:{filename}'

    INDEX_NAME_TEMPL = 'index-{timestamp}-{random}.cdxj'

    # overridable
    OPEN_REC_TTL = 5400

    COMMIT_WAIT_SECS = 30

    FULL_WARC_PREFIX = 'http://nginx:6090'

    @classmethod
    def init_props(cls, config):
        cls.OPEN_REC_TTL = int(config['open_rec_ttl'])
        #cls.INDEX_FILE_KEY = config['info_index_key']

        #cls.INDEX_NAME_TEMPL = config['index_name_templ']

        cls.FULL_WARC_PREFIX = config['full_warc_prefix']

        cls.COMMIT_WAIT_SECS = int(config['commit_wait_secs'])
        #cls.COMMIT_WAIT_TEMPL = config['commit_wait_templ']

    def init_new(self, desc='', rec_type=None, ra_list=None):
        rec = self._create_new_id()

        open_rec_key = self.OPEN_REC_KEY.format(rec=rec)

        self.data = {'desc': desc,
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

    def serialize(self):
        data = super(Recording, self).serialize(include_duration=True)

        # add pages
        data['pages'] = self.list_pages()

        # add any remote archive sources
        ra_key = self.RA_KEY.format(rec=self.my_id)
        data['ra_sources'] = list(self.redis.smembers(ra_key))
        data['title'] = self.get_title()
        return data

    def get_title(self):
        #TODO: remove title altogether?
        created_at = self.get_prop('created_at')
        if created_at:
            created_at = self.to_iso_date(created_at)
        else:
            created_at = '<unknown>'

        return 'Recording on ' + created_at

    def delete_me(self):
        if not self.queue_delete_warcs():
            return False

        return self.delete_object()

    def iter_all_files(self, skip_index=True):
        warc_key = self.WARC_KEY.format(rec=self.my_id)

        all_files = self.redis.hgetall(warc_key)

        for n, v in all_files.items():
            if skip_index and n == self.INDEX_FILE_KEY:
                continue

            yield n, v

    def queue_delete_warcs(self):
        fail = False
        with redis_pipeline(self.redis) as pi:
            for n, v in self.iter_all_files(skip_index=False):
                parts = urlsplit(v)
                if parts.scheme == 'http':
                    target = parts.netloc
                elif parts.scheme:
                    target = parts.scheme
                    if '+' in target:
                        target = target.split('+', 1)[0]
                else:
                    target = 'local'

                if target == 'local':
                    if self.redis.publish('handle_delete', v) == 0:
                        fail = True
                else:
                    pi.rpush(self.DEL_Q.format(target=target), v)

        return not fail

    def queue_move_warcs(self, to_user):
        data = {'rec': self.my_id,
                'user': to_user.name
               }

        self.redis.rpush(self.MOVE_Q.format(target='local'), json.dumps(data))

    def _get_pagedata(self, pagedata):
        key = self.PAGE_KEY.format(rec=self.my_id)

        url = pagedata['url']

        ts = pagedata.get('timestamp')
        if not ts:
            ts = pagedata.get('ts')

        if not ts:
            ts = self._get_url_ts(url)

        if not ts:
            ts = timestamp_now()

        pagedata['timestamp'] = ts
        pagedata_json = json.dumps(pagedata)

        hkey = pagedata['url'] + ' ' + pagedata['timestamp']

        return key, hkey, pagedata_json

    def _get_url_ts(self, url):
        try:
            key, end_key = calc_search_range(url, 'exact')
        except:
            return None

        cdxj_key = self.CDXJ_KEY.format(rec=self.my_id)

        result = self.redis.zrangebylex(cdxj_key,
                                        '[' + key,
                                        '(' + end_key)
        if not result:
            return None

        last_cdx = CDXObject(result[-1].encode('utf-8'))

        return last_cdx['timestamp']

    def add_page(self, pagedata, check_dupes=False):
        self.access.assert_can_write_coll(self.get_owner())

        if not self.is_open():
            return {'error': 'recording_done'}

        # if check dupes, check for existing page and avoid adding duplicate
        #if check_dupes:
        #    if self.has_page(pagedata['url'], pagedata['timestamp']):
        #        return {}

        key, hkey, pagedata_json = self._get_pagedata(pagedata)

        self.redis.hset(key, hkey, pagedata_json)

        return {}

    def _has_page(self, user, coll, url, ts):
        self.access.assert_can_read_coll(self.get_owner())

        all_page_keys = self._get_rec_keys(user, coll, self.page_key)

        hkey = url + ' ' + ts

        for key in all_page_keys:
            if self.redis.hget(key, hkey):
                return True

    def import_pages(self, pagelist):
        self.access.assert_can_admin_coll(self.get_owner())

        pagemap = {}

        for pagedata in pagelist:
            key, hkey, pagedata_json = self._get_pagedata(pagedata)

            pagemap[hkey] = pagedata_json

        self.redis.hmset(key, pagemap)

        return {}

    def modify_page(self, new_pagedata):
        self.access.assert_can_admin_coll(self.get_owner())

        key = self.PAGE_KEY.format(rec=self.my_id)

        page_key = new_pagedata['url'] + ' ' + new_pagedata['timestamp']

        pagedata = self.redis.hget(key, page_key)
        pagedata = json.loads(pagedata)
        pagedata.update(new_pagedata)

        pagedata_json = json.dumps(pagedata)

        self.redis.hset(key,
                        pagedata['url'] + ' ' + pagedata['timestamp'],
                        pagedata_json)

        return {}

    def delete_page(self, url, ts):
        self.access.assert_can_admin_coll(self.get_owner())

        key = self.PAGE_KEY.format(rec=self.my_id)

        res = self.redis.hdel(key, url + ' ' + ts)
        if res == 1:
            return {}
        else:
            return {'error': 'not found'}

    def list_pages(self):
        self.access.assert_can_read_coll(self.get_owner())

        key = self.PAGE_KEY.format(rec=self.my_id)

        pagelist = self.redis.hvals(key)

        pagelist = [json.loads(x) for x in pagelist]

        # add page ids
        for page in pagelist:
            bk_attrs = (page['url'] + page['timestamp']).encode('utf-8')
            page['id'] = hashlib.md5(bk_attrs).hexdigest()[:10]

        if not self.access.can_admin_coll(self.get_owner()):
            pagelist = [page for page in pagelist if page.get('hidden') != '1']

        return pagelist

    def count_pages(self):
        self.access.assert_can_read_coll(self.get_owner())

        key = self.PAGE_KEY.format(rec=self.my_id)
        count = self.redis.hlen(key)

        return count

    def track_remote_archive(self, pi, source_id):
        ra_key = self.RA_KEY.format(rec=self.my_id)
        pi.sadd(ra_key, source_id)

    def write_cdxj(self, user, warc_key, cdxj_key):
        full_filename = self.redis.hget(warc_key, self.INDEX_FILE_KEY)
        if full_filename:
            cdxj_filename = os.path.basename(self.strip_prefix(full_filename))
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

        full_url = self.FULL_WARC_PREFIX + full_filename.replace(os.path.sep, '/')
        self.redis.hset(warc_key, self.INDEX_FILE_KEY, full_url)

        return cdxj_filename, full_filename

    def commit_to_storage(self, storage):
        info_key = self.INFO_KEY.format(rec=self.my_id)
        cdxj_key = self.CDXJ_KEY.format(rec=self.my_id)
        warc_key = self.WARC_KEY.format(rec=self.my_id)

        self.set_closed()
        self.redis.publish('close_rec', info_key)

        collection = self.get_owner()
        user = collection.get_owner()

        cdxj_filename, full_cdxj_filename = self.write_cdxj(user, warc_key, cdxj_key)

        all_done = True

        if not user.is_anon() and storage:
            all_done = self.commit_file(user, collection, storage,
                                        cdxj_filename, full_cdxj_filename, 'indexes',
                                        warc_key, self.INDEX_FILE_KEY, direct_delete=True)

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

        if not storage or user.is_anon():
            return False

        full_filename = self.strip_prefix(full_filename)

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
             if self.redis.publish('handle_delete', full_filename) < 1:
                print('No Delete Listener!')

        return True

    def strip_prefix(self, uri):
        if self.FULL_WARC_PREFIX and uri.startswith(self.FULL_WARC_PREFIX):
            return uri[len(self.FULL_WARC_PREFIX):]

        return uri

    def queue_copy(self, source):
        if not self.is_open():
            return False

        data = {
                'target': self.my_id,
                'source': source.my_id,
               }

        self.redis.rpush(self.COPY_Q, json.dumps(data))
        return True

    def copy_data_from_recording(self, source):
        user = self.get_owner().get_owner()

        target_dirname = user.get_user_temp_warc_path()
        target_warc_key = self.WARC_KEY.format(rec=self.my_id)

        # Copy WARCs
        loader = BlockLoader()

        for n, url in source.iter_all_files(skip_index=False):
            local_filename = n + '.' + timestamp20_now()
            target_file = os.path.join(target_dirname, local_filename)

            src = loader.load(url)

            try:
                with open(target_file, 'wb') as dest:
                    shutil.copyfileobj(src, dest)

                size = os.path.getsize(target_file)

                if n != self.INDEX_FILE_KEY:
                    self.incr_size(size)

                self.redis.hset(target_warc_key, n, self.FULL_WARC_PREFIX + target_file)

            except:
                import traceback
                traceback.print_exc()

        # COPY cdxj, if exists
        source_key = self.CDXJ_KEY.format(rec=source.my_id)
        target_key = self.CDXJ_KEY.format(rec=self.my_id)

        self.redis.zunionstore(target_key, [source_key])

        # COPY pagelist
        pages = self.redis.hgetall(self.PAGE_KEY.format(rec=source.my_id))
        if pages:
            self.redis.hmset(self.PAGE_KEY.format(rec=self.my_id), pages)


