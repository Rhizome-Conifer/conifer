import json
import hashlib


# ============================================================================
class PagesMixin(object):
    PAGES_KEY = 'c:{coll}:p'
    PAGE_BOOKMARKS_KEY = 'c:{coll}:p:{page}:b'

    def __init__(self, **kwargs):
        super(PagesMixin, self).__init__(**kwargs)
        self._pages_cache = None

    @property
    def pages_key(self):
        return self.PAGES_KEY.format(coll=self.my_id)

    def add_page(self, props, recording):
        self.access.assert_can_write_coll(self)

        page = {'url': props['url'],
                'timestamp': props.get('timestamp', ''),
                'title': props['title'],
                'rec': recording.my_id,
               }

        if props.get('browser'):
            page['browser'] = props.get('browser')

        pid = self._new_page_id(page)

        self.redis.hset(self.pages_key, pid, json.dumps(page))

        return pid

    def _new_page_id(self, page):
        page_attrs = (page['url'] + page['timestamp'] + page.get('rec', '') + page.get('browser', '')).encode('utf-8')
        return hashlib.md5(page_attrs).hexdigest()[:10]

    def delete_page(self, pid):
        page_bookmarks_key = self.PAGE_BOOKMARKS_KEY.format(coll=self.my_id, page=pid)
        page_bookmarks = self.redis.hgetall(page_bookmarks_key)

        for bid, list_id in page_bookmarks.items():
            blist = self.get_list(list_id)
            if blist:
                blist.remove_bookmark(bid)

        self.redis.hdel(self.pages_key, pid)
        self.redis.delete(page_bookmarks_key)

    def page_exists(self, pid):
        return self.redis.hexists(self.pages_key, pid)

    def get_page(self, pid):
        page = self.redis.hget(self.pages_key, pid)
        if page:
            page = json.loads(page)
            page['id'] = pid
            return page

    def count_pages(self):
        self.access.assert_can_read_coll(self)

        return self.redis.hlen(self.pages_key)

    def list_pages(self):
        page_data = self.redis.hgetall(self.pages_key)
        pages = []

        for n, v in page_data.items():
            page = json.loads(v)
            page['id'] = n
            pages.append(page)

        return pages

    def list_rec_pages(self, recording):
        return self.list_rec_pages_by_id(recording.my_id)

    def list_rec_pages_by_id(self, rec_id):
        if not self._pages_cache:
            self._pages_cache = self.list_pages()

        return [page for page in self._pages_cache if page.get('rec') == rec_id]

    def get_pages_for_list(self, id_list):
        if not id_list:
            return []

        page_data_list = self.redis.hmget(self.pages_key, id_list)
        return page_data_list

    def delete_rec_pages(self, recording):
        self.access.assert_can_write_coll(self)

        rec_pages = self.list_rec_pages(recording)

        for n in rec_pages:
            self.delete_page(n['id'])

    def import_pages(self, pagelist, recording):
        if not pagelist:
            return

        self.access.assert_can_write_coll(self)

        pages = {}
        id_map = {}

        for page in pagelist:
            if 'ts' in page and 'timestamp' not in page:
                page['timestamp'] = page.pop('ts')

            page['rec'] = recording.my_id
            pid = self._new_page_id(page)
            if page.get('id'):
                id_map[page['id']] = pid

            page['id'] = pid

            pages[pid] = json.dumps(page)

        self.redis.hmset(self.pages_key, pages)
        return id_map

    def add_page_bookmark(self, pid, bid, list_id):
        key = self.PAGE_BOOKMARKS_KEY.format(coll=self.my_id, page=pid)
        self.redis.hset(key, bid, list_id)

    def remove_page_bookmark(self, pid, bid):
        key = self.PAGE_BOOKMARKS_KEY.format(coll=self.my_id, page=pid)
        self.redis.hdel(key, bid)

    def get_page_bookmarks(self, rec_id=None):
        bookmarks = {}

        if not rec_id:
            page_iter = self.redis.scan_iter(match=self.PAGE_BOOKMARKS_KEY.format(coll=self.my_id, page='*'),
                                             count=100)
            page_iter = [(key, key.split(':')[3]) for key in page_iter]

        else:
            page_iter = [(self.PAGE_BOOKMARKS_KEY.format(coll=self.my_id, page=page['id']), page['id']) for page in self.list_rec_pages_by_id(rec_id)]

        for key, pid in page_iter:
            bookmarks[pid] = self.redis.hgetall(key)

        return bookmarks

