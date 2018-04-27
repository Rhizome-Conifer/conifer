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
        page_attrs = (page['url'] + page['timestamp']).encode('utf-8')
        return hashlib.md5(page_attrs).hexdigest()[:10]

    def is_matching_page(self, pid, page):
        try:
            return self._new_page_id(page) == pid
        except:
            return False

    def delete_page(self, pid):
        self.redis.hdel(self.pages_key, pid)

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
        if not self._pages_cache:
            self._pages_cache = self.list_pages()

        return [page for page in self._pages_cache if page.get('rec') == recording.my_id]

    def delete_rec_pages(self, recording):
        self.access.assert_can_write_coll(self)

        rec_pages = self.list_rec_pages(recording)

        for n in rec_pages:
            self.delete_page(n)

    def import_pages(self, pagelist, recording):
        if not pagelist:
            return

        self.access.assert_can_write_coll(self)

        pages = {}

        for page in pagelist:
            if 'ts' in page and 'timestamp' not in page:
                page['timestamp'] = page.pop('ts')

            pid = self._new_page_id(page)
            page['rec'] = recording.my_id

            pages[pid] = json.dumps(page)

        self.redis.hmset(self.pages_key, pages)

    def add_page_bookmark(self, pid, bookmark):
        key = self.PAGE_BOOKMARKS_KEY.format(coll=self.my_id, page=pid)
        self.redis.hset(key, bookmark.my_id, bookmark.get_prop('owner'))

    def remove_page_bookmark(self, pid, bookmark):
        key = self.PAGE_BOOKMARKS_KEY.format(coll=self.my_id, page=pid)
        self.redis.hdel(key, bookmark.my_id)

    def get_page_bookmarks(self):
        bookmarks = {}

        for key in self.redis.scan_iter(match=self.PAGE_BOOKMARKS_KEY.format(coll=self.my_id, page='*'),
                                        count=100):
            pid = key.split(':')[3]
            bookmarks[pid] = self.redis.hgetall(key)

        return bookmarks

