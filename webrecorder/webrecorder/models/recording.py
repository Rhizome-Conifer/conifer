import time
import json
import hashlib
import os

from six.moves.urllib.parse import urlsplit

from pywb.utils.canonicalize import calc_search_range
from pywb.warcserver.index.cdxobject import CDXObject

from webrecorder.utils import redis_pipeline
from webrecorder.models.base import RedisUniqueComponent


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
    MOVE_Q = 'q:mov:{target}'

    OPEN_REC_TTL = 5400

    INDEX_FILE_KEY = '@index_file'

    @classmethod
    def init_props(cls, config):
        cls.OPEN_REC_TTL = int(config['open_rec_ttl'])
        cls.INDEX_FILE_KEY = config['info_index_key']

        cls.WARC_PATH_PREFIX = config['warc_path_templ']

    def init_new(self, title, rec_type=None, ra_list=None):
        rec = self.create_new_id()

        open_rec_key = self.OPEN_REC_KEY.format(rec=rec)

        now = int(time.time())

        self.data = {'title': title,
                     'created_at': now,
                     'updated_at': now,
                     'size': 0,
                    }

        if rec_type:
            self.data['rec_type'] = rec_type

        with redis_pipeline(self.redis) as pi:
            self.commit(pi)

            if ra_list:
                ra_key = self.RA_KEY.format(rec=self.my_id)
                pi.sadd(ra_key, *ra_list)

            pi.setex(open_rec_key, self.OPEN_REC_TTL, 1)

        return rec

    def is_open(self):
        open_rec_key = self.OPEN_REC_KEY.format(rec=self.my_id)
        return self.redis.expire(open_rec_key, self.OPEN_REC_TTL)

    def serialize(self):
        data = super(Recording, self).serialize()

        # add pages
        data['pages'] = self.list_pages()

        # add any remote archive sources
        ra_key = self.RA_KEY.format(rec=self.my_id)
        data['ra_sources'] = list(self.redis.smembers(ra_key))
        return data

    def delete_me(self):
        self.delete_warcs()

        return self.delete_object()

    def iter_all_files(self, skip_index=True):
        warc_key = self.WARC_KEY.format(rec=self.my_id)

        all_files = self.redis.hgetall(warc_key)

        for n, v in all_files.items():
            if skip_index and n == self.INDEX_FILE_KEY:
                continue

            yield n, v

    def delete_warcs(self):
        with redis_pipeline(self.redis) as pi:
            for n, v in self.iter_all_files(skip_index=False):
                parts = urlsplit(v)
                if parts.scheme == 'http':
                    target = parts.netloc
                elif parts.scheme:
                    target = parts.scheme
                else:
                    target = 'nginx'

                pi.rpush(self.DEL_Q.format(target=target), v)

    def move_warcs(self, to_user):
        move = {}
        move['hkey'] = self.WARC_KEY.format(rec=self.my_id)
        move['to_user'] = to_user.name

        with redis_pipeline(self.redis) as pi:
            for n, v in self.iter_all_files(skip_index=False):
                move['from'] = v
                move['name'] = n

                pi.rpush(self.MOVE_Q.format(target='local'), json.dumps(move))

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
            return {'error_msg': 'recording not open'}

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


