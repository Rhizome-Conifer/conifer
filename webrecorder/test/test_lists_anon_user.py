from .testutils import BaseWRTests, FullStackTests
from itertools import count
import time

from mock import patch

from webrecorder.models.list_bookmarks import BookmarkList
from webrecorder.models.stats import Stats
from webrecorder.utils import today_str


# ============================================================================
class TestListsAnonUserAPI(FullStackTests):
    ID_1 = 'e5371563ab'

    @classmethod
    def setup_class(cls):
        super(TestListsAnonUserAPI, cls).setup_class()
        cls.set_uuids('BookmarkList', count(1001))
        cls.set_uuids('Recording', ['rec'])

        def new_bookmark_id(gen):
            def new_bookmark_id_actual(max_len=None):
                return str(next(gen))

            return new_bookmark_id_actual

        cls.bid_mock = patch('webrecorder.models.list_bookmarks.BookmarkList.get_new_bookmark_id',
                            new_bookmark_id(count(101)))

        cls.bid_mock.start()

    @classmethod
    def teardown_class(cls):
        cls.bid_mock.stop()

        super(TestListsAnonUserAPI, cls).teardown_class()

    def _format(self, url):
        return url.format(user=self.anon_user)

    def _add_page(self, rec, title,
                      url='http://example.com/',
                      timestamp='20181226000800',
                      browser='chrome:60'):

        params = {'title': title,
                  'url': url,
                  'timestamp': timestamp,
                  'browser': browser,
                 }

        res = self.testapp.post_json(self._format('/api/v1/recording/%s/pages?user={user}&coll=temp' % rec), params=params)
        return res.json['page_id']

    def _add_bookmark(self, list_id, title,
                      url='http://example.com/',
                      timestamp='20181226000800',
                      browser='chrome:60',
                      desc='A description for this bookmark',
                      page_id=None,
                      status=None,
                      rec='rec'):

        params = {'title': title,
                  'url': url,
                  'timestamp': timestamp,
                  'browser': browser,
                  'desc': desc,
                 }

        if page_id:
            params['page_id'] = page_id

        res = self.testapp.post_json(self._format('/api/v1/list/%s/bookmarks?user={user}&coll=temp' % list_id), params=params, status=status)
        return res

    def test_create_anon_coll(self):
        res = self.testapp.post_json(self._format('/api/v1/collections?user={user}'), params={'title': 'Temp'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['collection']['id'] == 'temp'
        assert res.json['collection']['title'] == 'Temp'

        _coll, _ = self.get_coll_rec(self.anon_user, 'temp', '')

        TestListsAnonUserAPI.coll = _coll

    def test_create_list(self):
        params = {'title': 'New List',
                  'desc': 'List Description Goes Here!'
                 }

        res = self.testapp.post_json(self._format('/api/v1/lists?user={user}&coll=temp'), params=params)

        blist = res.json['list']
        assert blist['created_at'] == blist['updated_at']
        assert self.ISO_DT_RX.match(blist['created_at'])
        assert self.ISO_DT_RX.match(blist['updated_at'])

        assert blist['title'] == 'New List'
        assert blist['owner'] == self.coll
        assert blist['id'] == '1001'
        assert blist['desc'] == 'List Description Goes Here!'
        assert blist['public'] == False
        assert blist['slug'] == 'new-list'

        assert self.redis.hget('l:1001:info', 'public') == '0'

        #assert self.redis.get(BookmarkList.COUNTER_KEY) == '1001'

    def test_create_list_again(self):
        params = {'title': 'New List'}

        res = self.testapp.post_json(self._format('/api/v1/lists?user={user}&coll=temp'), params=params)

        assert res.json['list']['id'] == '1002'
        assert res.json['list']['title'] == 'New List'
        assert res.json['list']['slug'] == 'new-list-2'

    def test_create_another_list(self):
        params = {'title': 'Another List'}

        res = self.testapp.post_json(self._format('/api/v1/lists?user={user}&coll=temp'), params=params)

        assert res.json['list']['id'] == '1003'
        assert res.json['list']['title'] == 'Another List'
        assert res.json['list']['public'] == False

    def test_get_list_by_slug(self):
        res = self.testapp.get(self._format('/api/v1/list/new-list-2?user={user}&coll=temp'))

        assert res.json['list']['id'] == '1002'
        assert res.json['list']['title'] == 'New List'
        assert res.json['list']['public'] == False
        assert res.json['list']['slug'] == 'new-list-2'
        assert res.json['list']['slug_matched'] == True

    def test_get_list_by_id(self):
        res = self.testapp.get(self._format('/api/v1/list/1002?user={user}&coll=temp'))

        assert res.json['list']['id'] == '1002'
        assert res.json['list']['title'] == 'New List'
        assert res.json['list']['public'] == False
        assert res.json['list']['slug'] == 'new-list-2'
        assert res.json['list']['slug_matched'] == False

    def test_list_all_lists(self):
        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))

        lists = res.json['lists']
        assert len(lists) == 3

        assert ['1001', '1002', '1003'] == list(l['id'] for l in lists)
        assert ['New List', 'New List', 'Another List'] == list(l['title'] for l in lists)

    def test_move_list_err_no_before(self):
        params = {'before_id': '1005'}
        res = self.testapp.post_json(self._format('/api/v1/list/1001/move?user={user}&coll=temp'), params=params, status=404)

        assert res.json['error'] == 'no_such_list'

    def test_move_list(self):
        params = {'before_id': '1003'}
        res = self.testapp.post_json(self._format('/api/v1/list/1001/move?user={user}&coll=temp'), params=params)

        assert res.json == {'success': True}

        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))

        lists = res.json['lists']
        assert len(lists) == 3

        assert ['1002', '1001', '1003'] == list(l['id'] for l in lists)
        assert ['New List', 'New List', 'Another List'] == list(l['title'] for l in lists)

    def test_move_list_last(self):
        params = {}

        res = self.testapp.post_json(self._format('/api/v1/list/1002/move?user={user}&coll=temp'), params=params)

        assert res.json == {'success': True}

        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))

        lists = res.json['lists']
        assert len(lists) == 3

        assert ['1001', '1003', '1002'] == list(l['id'] for l in lists)
        assert ['New List', 'Another List', 'New List'] == list(l['title'] for l in lists)

        scores = self.redis.zrange('c:{coll}:lists'.format(coll=self.coll), 0, -1, withscores=True)
        assert scores == [('1001', 2560.0), ('1003', 3072.0), ('1002', 3584.0)]

    def test_reorder_error_not_enough_elements(self):
        params = {'order': ['1002', '1001']}
        res = self.testapp.post_json(self._format('/api/v1/lists/reorder?user={user}&coll=temp'), params=params, status=400)

        assert res.json == {'error': 'invalid_order'}

    def test_reorder_error_dupe_elements(self):
        params = {'order': ['1002', '1001', '1003', '1001']}
        res = self.testapp.post_json(self._format('/api/v1/lists/reorder?user={user}&coll=temp'), params=params, status=400)

        assert res.json == {'error': 'invalid_order'}

    def test_reorder_error_invalid_elements(self):
        params = {'order': ['1002', '1001', '1004']}
        res = self.testapp.post_json(self._format('/api/v1/lists/reorder?user={user}&coll=temp'), params=params, status=400)

        assert res.json == {'error': 'invalid_order'}

    def test_reorder_lists(self):
        params = {'order': ['1002', '1001', '1003']}
        res = self.testapp.post_json(self._format('/api/v1/lists/reorder?user={user}&coll=temp'), params=params)

        assert res.json == {'success': True}

        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))

        lists = res.json['lists']

        assert ['1002', '1001', '1003'] == list(l['id'] for l in lists)
        assert ['New List', 'New List', 'Another List'] == list(l['title'] for l in lists)

    def test_delete_list(self):
        assert len(self.redis.keys('l:1001:*')) > 0

        assert self.redis.hget('c:{coll}:ln'.format(coll=self.coll), 'new-list') == '1001'

        res = self.testapp.delete(self._format('/api/v1/list/1001?user={user}&coll=temp'))

        assert res.json == {'deleted_id': '1001'}
        assert len(self.redis.keys('l:1001:*')) == 0

        assert self.redis.hget('c:{coll}:ln'.format(coll=self.coll), 'new-list') == None

        assert self.redis.hgetall('c:{coll}:ln'.format(coll=self.coll)) == {'another-list': '1003', 'new-list-2': '1002'}


        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))

        lists = res.json['lists']
        assert len(lists) == 2

        assert ['1002', '1003'] == list(l['id'] for l in lists)
        assert ['New List', 'Another List'] == list(l['title'] for l in lists)

    def test_update_err_no_such_list(self):
        params = {'title': 'A List'}
        res = self.testapp.post_json(self._format('/api/v1/list/1001?user={user}&coll=temp'), params=params, status=404)

    def test_update_rename_list(self):
        params = {'title': 'A List'}

        time.sleep(1)

        res = self.testapp.post_json(self._format('/api/v1/list/1002?user={user}&coll=temp'), params=params)

        blist = res.json['list']

        assert blist['title'] == 'A List'
        assert blist['id'] == '1002'
        assert blist['slug'] == 'a-list'

        assert blist['created_at'] < blist['updated_at']

        assert self.ISO_DT_RX.match(blist['updated_at'])

    def test_get_list_by_old_slug(self):
        res = self.testapp.get(self._format('/api/v1/list/new-list-2?user={user}&coll=temp'))

        assert res.json['list']['id'] == '1002'
        assert res.json['list']['title'] == 'A List'
        assert res.json['list']['public'] == False
        assert res.json['list']['slug'] == 'a-list'
        assert res.json['list']['slug_matched'] == False

    def test_update_list_public(self):
        params = {'public': True}

        res = self.testapp.post_json(self._format('/api/v1/list/1002?user={user}&coll=temp'), params=params)

        blist = res.json['list']
        assert blist['title'] == 'A List'
        assert blist['id'] == '1002'
        assert blist['public'] == True

        assert self.redis.hget('l:1002:info', 'public') == '1'

    def test_update_list_private(self):
        params = {'public': False}

        res = self.testapp.post_json(self._format('/api/v1/list/1002?user={user}&coll=temp'), params=params)

        blist = res.json['list']
        assert blist['title'] == 'A List'
        assert blist['id'] == '1002'
        assert blist['public'] == False

        assert self.redis.hget('l:1002:info', 'public') == '0'


    # Record, then Replay Via List
    # ========================================================================
    def test_record_1(self):
        res = self.testapp.get('/_new/temp/rec/record/mp_/http://example.com/')
        assert res.status_code == 302
        res = res.follow()
        res.charset = 'utf-8'

        assert 'Example Domain' in res.text

    def test_replay_1(self):
        res = self.testapp.get('/{user}/temp/list/1002/b1/mp_/http://example.com/'.format(user=self.anon_user), status=200)
        res.charset = 'utf-8'

        assert 'Example Domain' in res.text

        assert 'wbinfo.top_url = "http://localhost:80/{user}/temp/list/1002/b1/http://example.com/"'.format(user=self.anon_user) in res.text, res.text

    # Pages
    # ========================================================================
    def test_create_page(self):
        page_id = self._add_page('rec', title='A Page', url='http://example.com/испытание/test')
        assert page_id == self.ID_1


    # Bookmarks
    # ========================================================================
    def test_create_bookmark(self):
        res = self._add_bookmark('1002', title='An Example (испытание)', url='http://example.com/испытание/test',
                                 page_id=self.ID_1)

        bookmark = res.json['bookmark']

        #assert bookmark['created_at'] == bookmark['updated_at']
        #assert self.ISO_DT_RX.match(bookmark['created_at'])
        #assert self.ISO_DT_RX.match(bookmark['updated_at'])

        assert bookmark['title'] == 'An Example (испытание)'
        #assert bookmark['owner'] == '1002'
        assert bookmark['id'] == '101'
        assert bookmark['url'] == 'http://example.com/испытание/test'
        assert bookmark['timestamp'] == '20181226000800'
        assert bookmark['browser'] == 'chrome:60'
        assert bookmark['desc'] == 'A description for this bookmark'

        assert bookmark['page_id'] == self.ID_1
        assert bookmark['page']['id'] == self.ID_1
        assert bookmark['page']['url'] == bookmark['url']
        assert bookmark['page']['timestamp'] == bookmark['timestamp']

    def test_create_bookmark_error_no_such_page(self):
        res = self._add_bookmark('1002', title='An Example (испытание)', url='http://example.com/испытание/test',
                                 timestamp='2018', page_id='abc', status=400)

        # must be a valid page
        assert res.json['error'] == 'invalid_page'

    def test_get_bookmark_error_list_missing(self):
        res = self.testapp.get(self._format('/api/v1/bookmark/101?user={user}&coll=temp'), status=400)

    def test_get_bookmark(self):
        res = self.testapp.get(self._format('/api/v1/bookmark/101?user={user}&coll=temp&list=1002'))

        bookmark = res.json['bookmark']

        assert bookmark['title'] == 'An Example (испытание)'
        #assert bookmark['owner'] == '1002'
        assert bookmark['id'] == '101'
        assert bookmark['page_id'] == self.ID_1
        assert bookmark['page']['id'] == self.ID_1
        assert bookmark['page']['url'] == bookmark['url']

    def test_get_all_bookmarks(self):
        res = self._add_bookmark('1003', title='An Example')

        res = self._add_bookmark('1002', title='Another Example', url='http://test.example.com/')
        res = self._add_bookmark('1002', title='Another Bookmark', url='http://test.example.com/')
        res = self._add_bookmark('1002', title='Some Other Example', url='http://iana.org/')
        res = self._add_bookmark('1002', title='More Example', url='http://example.com/some/page')

        res = self._add_bookmark('1003', title='Another Example', url='http://test.example.com/')

        # 1002 List
        res = self.testapp.get(self._format('/api/v1/list/1002/bookmarks?user={user}&coll=temp'))

        bookmarks = res.json['bookmarks']
        assert len(bookmarks) == 5

        assert ['An Example (испытание)',
                'Another Example',
                'Another Bookmark',
                'Some Other Example',
                'More Example'] == [b['title'] for b in bookmarks]

        assert ['101', '103', '104', '105', '106'] == [b['id'] for b in bookmarks]

        assert [self.ID_1, None, None, None, None] == [b.get('page', {}).get('id') for b in bookmarks]

    def test_reorder_bookmarks(self):
        params = {'order': ['103', '104', '105', '106', '101']}
        res = self.testapp.post_json(self._format('/api/v1/list/1002/bookmarks/reorder?user={user}&coll=temp'), params=params)

        assert res.json == {'success': True}

        # verify order
        res = self.testapp.get(self._format('/api/v1/list/1002/bookmarks?user={user}&coll=temp'))
        bookmarks = res.json['bookmarks']
        assert ['103', '104', '105', '106', '101'] == [b['id'] for b in bookmarks]

    def test_reorder_bookmarks_invalid(self):
        params = {'order': ['103', '104', '105', '106', '103', '101']}
        res = self.testapp.post_json(self._format('/api/v1/list/1002/bookmarks/reorder?user={user}&coll=temp'), params=params, status=400)

        assert res.json == {'error': 'invalid_order'}

    def test_delete_bookmark_not_existent(self):
        res = self.testapp.delete(self._format('/api/v1/bookmark/106?user={user}&coll=temp&list=1003'), status=404)
        assert res.json['error'] == 'no_such_bookmark'

    def test_delete_bookmark(self):
        #assert len(self.redis.keys('b:106:*')) > 0
        assert self.redis.hget('l:1002:b', '106') != None

        res = self.testapp.delete(self._format('/api/v1/bookmark/106?user={user}&coll=temp&list=1002'))

        assert res.json['deleted_id'] == '106'
        assert len(self.redis.keys('b:106:*')) == 0

        res = self.testapp.get(self._format('/api/v1/list/1002/bookmarks?user={user}&coll=temp'))
        bookmarks = res.json['bookmarks']
        assert ['103', '104', '105', '101'] == [b['id'] for b in bookmarks]

    def test_update_bookmark(self):
        params = {'title': 'A New Title?',
                  'timestamp': '201701',
                  'desc': 'New Description'
                 }

        res = self.testapp.post_json(self._format('/api/v1/bookmark/104?user={user}&coll=temp&list=1002'), params=params)

        bookmark = res.json['bookmark']
        assert bookmark['id'] == '104'
        assert bookmark['title'] == 'A New Title?'
        assert bookmark['timestamp'] == '201701'
        assert bookmark['desc'] == 'New Description'

    def test_get_lists_with_bookmarks(self):
        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))
        assert len(res.json['lists']) == 2

        assert res.json['lists'][0]['id'] == '1002'
        assert len(res.json['lists'][0]['bookmarks']) == 4

        assert res.json['lists'][0]['bookmarks'][2]['id'] == '105'
        assert res.json['lists'][0]['bookmarks'][2]['title'] == 'Some Other Example'

        assert res.json['lists'][0]['bookmarks'][1]['id'] == '104'
        assert res.json['lists'][0]['bookmarks'][1]['title'] == 'A New Title?'

    def test_bulk_add_bookmarks(self):
        bookmarks = [{'url': 'http://example.com/', 'title': 'Yet Another Example', 'timestamp': '20161226000000'},
                     {'url': 'http://httpbin.org/', 'title': 'HttpBin.org', 'timestamp': '201801020300000'},
                     {'url': 'http://test.example.com/foo', 'title': 'Just an example'}]

        list_id = '1003'
        res = self.testapp.post_json(self._format('/api/v1/list/%s/bulk_bookmarks?user={user}&coll=temp' % list_id),
                                     params=bookmarks)


        assert res.json['success'] == True

    def test_multiple_bookmarks_for_page(self):
        res = self._add_bookmark('1003', title='An Example 2', url='http://example.com/испытание/test',
                                 page_id=self.ID_1)

        # all
        res = self.testapp.get(self._format('/api/v1/collection/temp/page_bookmarks?user={user}'))

        assert res.json == {'page_bookmarks': {self.ID_1: {'111': '1003', '101': '1002'}}}

        # filter by rec
        res = self.testapp.get(self._format('/api/v1/collection/temp/page_bookmarks?user={user}&rec=rec'))

        assert res.json == {'page_bookmarks': {self.ID_1: {'111': '1003', '101': '1002'}}}

        # filter by non-existant rec
        res = self.testapp.get(self._format('/api/v1/collection/temp/page_bookmarks?user={user}&rec=rec-none'))

        assert res.json == {'page_bookmarks': {}}

        # all again (test cached)
        res = self.testapp.get(self._format('/api/v1/collection/temp/page_bookmarks?user={user}'))

        assert res.json == {'page_bookmarks': {self.ID_1: {'111': '1003', '101': '1002'}}}

        # filter by rec again
        res = self.testapp.get(self._format('/api/v1/collection/temp/page_bookmarks?user={user}&rec=rec'))

        assert res.json == {'page_bookmarks': {self.ID_1: {'111': '1003', '101': '1002'}}}

    def test_coll_info_with_lists(self):
        res = self.testapp.get(self._format('/api/v1/collection/temp?user={user}'))

        lists = res.json['collection']['lists']

        assert len(lists) == 2

        assert lists[0]['id'] == '1002'
        assert lists[0]['total_bookmarks'] == 4

        # only first bookmark loaded
        assert len(lists[0]['bookmarks']) == 1

        assert lists[1]['id'] == '1003'
        assert lists[1]['total_bookmarks'] == 6
        assert len(lists[1]['bookmarks']) == 1

    # Collection and User Info
    # ========================================================================
    def test_colls_info(self):
        res = self.testapp.get(self._format('/api/v1/collections?user={user}&include_lists=true&include_recordings=true'))

        assert len(res.json['collections']) == 1
        assert res.json['collections'][0]['id'] == 'temp'

        for coll in res.json['collections']:
            assert coll['lists']
            assert coll['recordings']

        res = self.testapp.get(self._format('/api/v1/collections?user={user}&include_lists=false&include_recordings=false'))

        for coll in res.json['collections']:
            assert 'lists' not in coll
            assert 'recordings' not in coll

        res = self.testapp.get(self._format('/api/v1/collections?user={user}&include_lists=0&include_recordings=1'))

        for coll in res.json['collections']:
            assert 'lists' not in coll
            assert 'recordings' in coll

    def test_user_info(self):
        res = self.testapp.get(self._format('/api/v1/user/{user}?include_colls=true'))

        user = res.json['user']

        assert len(user['collections']) == 1
        assert user['collections'][0]['id'] == 'temp'

        for coll in user['collections']:
            assert 'lists' not in coll
            assert 'recordings' not in coll

    # Delete Recording
    # ========================================================================
    def test_delete_rec(self):
        res = self.testapp.delete('/api/v1/recording/rec?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'rec'}

        # list still exists
        res = self.testapp.get(self._format('/api/v1/list/1002?user={user}&coll=temp'))

        assert res.json['list']

        # no bookmarks for deleted page
        res = self.testapp.get(self._format('/api/v1/collection/temp/page_bookmarks?user={user}'))

        assert res.json == {'page_bookmarks': {}}

        res = self.testapp.get(self._format('/api/v1/collection/temp?user={user}'))

        # no pages
        assert len(res.json['collection']['pages']) == 0

        lists = res.json['collection']['lists']

        assert len(lists) == 2

        # one bookmark less, (bookmark tied to page is removed)
        assert lists[0]['id'] == '1002'
        assert lists[0]['total_bookmarks'] == 3


        assert lists[1]['id'] == '1003'
        assert lists[1]['total_bookmarks'] == 5

    def test_delete_list_after_slug_update(self):
        assert self.redis.hgetall('c:{coll}:ln'.format(coll=self.coll)) == {'another-list': '1003', 'a-list': '1002'}
        assert self.redis.hgetall('c:{coll}:lr'.format(coll=self.coll)) == {'new-list-2': '1002'}

        res = self.testapp.delete(self._format('/api/v1/list/1002?user={user}&coll=temp'))

        assert res.json == {'deleted_id': '1002'}

        assert self.redis.hgetall('c:{coll}:ln'.format(coll=self.coll)) == {'another-list': '1003'}
        assert self.redis.hgetall('c:{coll}:lr'.format(coll=self.coll)) == {'new-list-2': '1002'}

        res = self.testapp.get(self._format('/api/v1/list/new-list-2?user={user}&coll=temp'), status=404)
        assert res.json == {'error': 'no_such_list'}

        res = self.testapp.get(self._format('/api/v1/list/a-list?user={user}&coll=temp'), status=404)
        assert res.json == {'error': 'no_such_list'}

    # Delete Collection
    # ========================================================================
    def test_delete_coll(self):
        res = self.testapp.delete('/api/v1/collection/temp?user={user}'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'temp'}

        assert len(self.redis.keys('l:*')) == 0
        assert len(self.redis.keys('b:*')) == 0

    # Stats
    # ========================================================================
    def test_stats(self):
        assert self.redis.hget(Stats.BOOKMARK_ADD_KEY, today_str()) == '11'
        assert self.redis.hget(Stats.BOOKMARK_MOD_KEY, today_str()) == '1'

        # only includes explicit deletions or from list deletion
        assert self.redis.hget(Stats.BOOKMARK_DEL_KEY, today_str()) == '3'


