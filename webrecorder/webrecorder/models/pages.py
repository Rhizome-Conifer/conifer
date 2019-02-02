import json
import hashlib


# ============================================================================
class PagesMixin(object):
    """Recording pages.

    :cvar str PAGES_KEY: pages Redis key template
    :cvar str PAGE_BOOKMARKS_CACHE_KEY: temporary list of pages->bookmarks Redis key template
    :ivar _pages_cache: n.s.
    """
    PAGES_KEY = 'c:{coll}:p'
    PAGE_BOOKMARKS_CACHE_KEY = 'c:{coll}:p_to_b'

    def __init__(self, **kwargs):
        """Initialize recording pages."""
        super(PagesMixin, self).__init__(**kwargs)
        self._pages_cache = None

    @property
    def pages_key(self):
        """Read-only property pages_key.

        :returns: pages_key
        :rtype: str
        """
        return self.PAGES_KEY.format(coll=self.my_id)

    def add_page(self, props, recording):
        """Add page to recording.

        :param dict props: page properties
        :param Recording recording: recording

        :returns: page ID
        :rtype: str
        """
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
        """Return new page ID.

        :param dict page: page

        :returns: page ID
        :rtype: str
        """
        page_attrs = (page['url'] + page['timestamp'] + page.get('rec', '') + page.get('browser', '')).encode('utf-8')
        return hashlib.md5(page_attrs).hexdigest()[:10]

    def delete_page(self, pid, all_page_bookmarks):
        """Delete page.

        :param str pid: page ID
        :param dict all_page_bookmarks: list of bookmarks
        """
        page_bookmarks = all_page_bookmarks.get(pid, {})
        for bid, list_id in page_bookmarks.items():
            blist = self.get_list(list_id)
            if blist:
                blist.remove_bookmark(bid)

        self.redis.hdel(self.pages_key, pid)

        page_bookmarks_key = self.PAGE_BOOKMARKS_CACHE_KEY.format(coll=self.my_id)
        self.redis.hdel(page_bookmarks_key, pid)

    def page_exists(self, pid):
        """Return whether page exists.

        :param str pid: page ID

        :returns: whether page exists (1/0)
        :rtype: int
        """
        return self.redis.hexists(self.pages_key, pid)

    def get_page(self, pid):
        """Return page.

        :param str pid: page ID

        :returns page or None
        :rtype: dict
        """
        page = self.redis.hget(self.pages_key, pid)
        if page:
            page = json.loads(page)
            page['id'] = pid
            return page

    def count_pages(self):
        """Return number of pages.

        :returns: number of pages
        :rtype: int
        """
        self.access.assert_can_read_coll(self)

        return self.redis.hlen(self.pages_key)

    def list_pages(self):
        """List pages.

        :returns: list of pages
        :rtype: list
        """
        page_data = self.redis.hgetall(self.pages_key)
        pages = []

        for n, v in page_data.items():
            page = json.loads(v)
            page['id'] = n
            pages.append(page)

        return pages

    def list_rec_pages(self, recording):
        """List pages in recording.

        :param Recording recording: recording

        :returns: list of pages
        :rtype: list
        """
        rec_id = recording.my_id

        if not self._pages_cache:
            self._pages_cache = self.list_pages()

        return [page for page in self._pages_cache if page.get('rec') == rec_id]

    def get_pages_for_list(self, id_list):
        """List all pages in list of page IDs.

        :param list id_list: list of page IDs

        :returns: list of pages
        :rtype: list
        """
        if not id_list:
            return []

        page_data_list = self.redis.hmget(self.pages_key, id_list)
        return page_data_list

    def delete_rec_pages(self, recording):
        """Delete pages from recording.

        :param Recording recording: recording
        """
        self.access.assert_can_write_coll(self)

        rec_pages = self.list_rec_pages(recording)

        all_page_bookmarks = self.get_all_page_bookmarks(rec_pages)

        for n in rec_pages:
            self.delete_page(n['id'], all_page_bookmarks)

    def import_pages(self, pagelist, recording):
        """Import pages into recording.

        :param list pagelist: list of pages
        :param Recording recording: recording

        :returns: mapping page IDs to new page IDs
        :rtype: dict
        """
        if not pagelist:
            return {}

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

    def clear_page_bookmark_cache(self):
        """ Check if on-demand page->bookmark cache already exists
        """
        key = self.PAGE_BOOKMARKS_CACHE_KEY.format(coll=self.my_id)
        return self.redis.delete(key)

    def get_all_page_bookmarks(self, filter_pages=None):
        """List all bookmarks.

        :param filter_pages: filter
        :type: list or None
        """
        key = self.PAGE_BOOKMARKS_CACHE_KEY.format(coll=self.my_id)
        filter_pages = filter_pages or []
        filter_pages = [page['id'] for page in filter_pages]

        all_bookmarks = self.redis.hgetall(key)
        # cached, load json and filter by rec_id, if needed
        if all_bookmarks:
            bookmarks = {n: json.loads(v) for n, v in all_bookmarks.items()
                         if not filter_pages or n in filter_pages}

            return bookmarks

        all_lists = self.get_lists()

        all_bookmarks = {}

        # bin all bookmarks by page
        for blist in all_lists:
            for bk in blist.get_bookmarks():
                page_id = bk.get('page_id')
                if not page_id:
                    continue

                if page_id not in all_bookmarks:
                    all_bookmarks[page_id] = {bk['id']: blist.my_id}
                else:
                    all_bookmarks[page_id][bk['id']] = blist.my_id

        if not all_bookmarks:
            return {}

        filtered_bookmarks = {}

        # json encode and cache all bookmarks
        # return only bookmarks filtered by recording
        for page, bookmark in all_bookmarks.items():
            if not filter_pages or page in filter_pages:
                filtered_bookmarks[page] = bookmark

            all_bookmarks[page] = json.dumps(bookmark)

        self.redis.hmset(key, all_bookmarks)
        if self.COLL_CDXJ_TTL > 0:
            self.redis.expire(key, self.COLL_CDXJ_TTL)

        return filtered_bookmarks


