from .testutils import BaseWRTests, FullStackTests
import time

from webrecorder.models.list_bookmarks import BookmarkList, Bookmark


# ============================================================================
class TestListsAPI(FullStackTests):
    def _format(self, url):
        return url.format(user=self.anon_user)

    def _add_bookmark(self, list_id, title,
                      url='http://example.com/',
                      timestamp='20181226000800',
                      browser='chrome:60',
                      desc='A description for this bookmark'):

        params = {'title': title,
                  'url': url,
                  'timestamp': timestamp,
                  'browser': browser,
                  'desc': desc,
                 }

        res = self.testapp.post_json(self._format('/api/v1/list/%s/bookmarks?user={user}&coll=temp' % list_id), params=params)
        assert res.json['bookmark']
        return res

    def test_create_anon_coll(self):
        res = self.testapp.post_json(self._format('/api/v1/collections?user={user}'), params={'title': 'Temp'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['collection']['id'] == 'temp'
        assert res.json['collection']['title'] == 'Temp'

        _coll, _ = self.get_coll_rec(self.anon_user, 'temp', '')

        TestListsAPI.coll = _coll

        self.redis.set(BookmarkList.COUNTER_KEY, 1000)
        self.redis.set(Bookmark.COUNTER_KEY, 100)

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
        assert blist['public'] == '0'

        assert self.redis.get(BookmarkList.COUNTER_KEY) == '1001'

    def test_create_list_again(self):
        params = {'title': 'New List'}

        res = self.testapp.post_json(self._format('/api/v1/lists?user={user}&coll=temp'), params=params)

        assert res.json['list']['id'] == '1002'
        assert res.json['list']['title'] == 'New List'

    def test_create_another_list(self):
        params = {'title': 'Another List'}

        res = self.testapp.post_json(self._format('/api/v1/lists?user={user}&coll=temp'), params=params)

        assert res.json['list']['id'] == '1003'
        assert res.json['list']['title'] == 'Another List'

    def test_get_list(self):
        res = self.testapp.get(self._format('/api/v1/list/1002?user={user}&coll=temp'))

        assert res.json['list']['id'] == '1002'
        assert res.json['list']['title'] == 'New List'

    def test_list_all_lists(self):
        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))

        lists = res.json['lists']
        assert len(lists) == 3

        assert ['1001', '1002', '1003'] == list(l['id'] for l in lists)
        assert ['New List', 'New List', 'Another List'] == list(l['title'] for l in lists)

    def test_move_list_err_no_before(self):
        params = {'before_id': '1005'}
        res = self.testapp.post_json(self._format('/api/v1/list/1001/move?user={user}&coll=temp'), params=params, status=404)

        assert res.json['error_message'] == 'List not found'

    def test_move_list(self):
        params = {'before_id': '1003'}
        res = self.testapp.post_json(self._format('/api/v1/list/1001/move?user={user}&coll=temp'), params=params)

        assert res.json == {'success': 'list moved'}

        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))

        lists = res.json['lists']
        assert len(lists) == 3

        assert ['1002', '1001', '1003'] == list(l['id'] for l in lists)
        assert ['New List', 'New List', 'Another List'] == list(l['title'] for l in lists)

    def test_move_list_last(self):
        params = {}

        res = self.testapp.post_json(self._format('/api/v1/list/1002/move?user={user}&coll=temp'), params=params)

        assert res.json == {'success': 'list moved'}

        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))

        lists = res.json['lists']
        assert len(lists) == 3

        assert ['1001', '1003', '1002'] == list(l['id'] for l in lists)
        assert ['New List', 'Another List', 'New List'] == list(l['title'] for l in lists)

        scores = self.redis.zrange('c:{coll}:lists'.format(coll=self.coll), 0, -1, withscores=True)
        assert scores == [('1001', 2560.0), ('1003', 3072.0), ('1002', 3584.0)]

    def test_reorder_error_not_enough_elements(self):
        params = {'order': ['1002', '1001']}
        res = self.testapp.post_json(self._format('/api/v1/lists/reorder?user={user}&coll=temp'), params=params)

        assert res.json == {'error': 'invalid order'}

    def test_reorder_error_dupe_elements(self):
        params = {'order': ['1002', '1001', '1003', '1001']}
        res = self.testapp.post_json(self._format('/api/v1/lists/reorder?user={user}&coll=temp'), params=params)

        assert res.json == {'error': 'invalid order'}

    def test_reorder_error_invalid_elements(self):
        params = {'order': ['1002', '1001', '1004']}
        res = self.testapp.post_json(self._format('/api/v1/lists/reorder?user={user}&coll=temp'), params=params)

        assert res.json == {'error': 'invalid order'}

    def test_reorder_lists(self):
        params = {'order': ['1002', '1001', '1003']}
        res = self.testapp.post_json(self._format('/api/v1/lists/reorder?user={user}&coll=temp'), params=params)

        assert res.json == {'success': 'reordered'}

        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))

        lists = res.json['lists']

        assert ['1002', '1001', '1003'] == list(l['id'] for l in lists)
        assert ['New List', 'New List', 'Another List'] == list(l['title'] for l in lists)

    def test_delete_list(self):
        assert len(self.redis.keys('l:1001:*')) > 0

        res = self.testapp.delete(self._format('/api/v1/list/1001?user={user}&coll=temp'))

        assert res.json == {'deleted_id': '1001'}
        assert len(self.redis.keys('l:1001:*')) == 0

        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))

        lists = res.json['lists']
        assert len(lists) == 2

        assert ['1002', '1003'] == list(l['id'] for l in lists)
        assert ['New List', 'Another List'] == list(l['title'] for l in lists)

    def test_update_err_no_such_list(self):
        params = {'title': 'A List'}
        res = self.testapp.post_json(self._format('/api/v1/list/1001?user={user}&coll=temp'), params=params, status=404)

    def test_update_list(self):
        params = {'title': 'A List'}

        time.sleep(1)

        res = self.testapp.post_json(self._format('/api/v1/list/1002?user={user}&coll=temp'), params=params)

        blist = res.json['list']

        assert blist['title'] == 'A List'
        assert blist['id'] == '1002'

        assert blist['created_at'] < blist['updated_at']

        assert self.ISO_DT_RX.match(blist['updated_at'])

    # Bookmarks
    # ========================================================================
    def test_create_bookmark(self):
        res = self._add_bookmark('1002', title='An Example (испытание)', url='http://example.com/испытание/test')

        bookmark = res.json['bookmark']

        assert bookmark['created_at'] == bookmark['updated_at']
        assert self.ISO_DT_RX.match(bookmark['created_at'])
        assert self.ISO_DT_RX.match(bookmark['updated_at'])

        assert bookmark['title'] == 'An Example (испытание)'
        assert bookmark['owner'] == '1002'
        assert bookmark['id'] == '101'
        assert bookmark['url'] == 'http://example.com/испытание/test'
        assert bookmark['timestamp'] == '20181226000800'
        assert bookmark['browser'] == 'chrome:60'
        assert bookmark['desc'] == 'A description for this bookmark'

        assert self.redis.get(Bookmark.COUNTER_KEY) == '101'

    def test_get_bookmark_error_list_missing(self):
        res = self.testapp.get(self._format('/api/v1/bookmark/101?user={user}&coll=temp'), status=400)

    def test_get_bookmark(self):
        res = self.testapp.get(self._format('/api/v1/bookmark/101?user={user}&coll=temp&list=1002'))

        bookmark = res.json['bookmark']

        assert bookmark['title'] == 'An Example (испытание)'
        assert bookmark['owner'] == '1002'
        assert bookmark['id'] == '101'

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

    def test_reorder_bookmarks(self):
        params = {'order': ['103', '104', '105', '106', '101']}
        res = self.testapp.post_json(self._format('/api/v1/list/1002/bookmarks/reorder?user={user}&coll=temp'), params=params)

        assert res.json == {'success': 'reordered'}

        # verify order
        res = self.testapp.get(self._format('/api/v1/list/1002/bookmarks?user={user}&coll=temp'))
        bookmarks = res.json['bookmarks']
        assert ['103', '104', '105', '106', '101'] == [b['id'] for b in bookmarks]

    def test_reorder_bookmarks_invalid(self):
        params = {'order': ['103', '104', '105', '106', '103', '101']}
        res = self.testapp.post_json(self._format('/api/v1/list/1002/bookmarks/reorder?user={user}&coll=temp'), params=params)

        assert res.json == {'error': 'invalid order'}

    def test_delete_bookmark_not_existent(self):
        res = self.testapp.delete(self._format('/api/v1/bookmark/106?user={user}&coll=temp&list=1003'), status=404)

        assert res.json['error_message'] == 'Bookmark not found in list'

    def test_delete_bookmark(self):
        assert len(self.redis.keys('b:106:*')) > 0

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


        assert res.json['list']

    def test_coll_info_with_lists(self):
        res = self.testapp.get(self._format('/api/v1/collection/temp?user={user}'))

        lists = res.json['collection']['lists']

        assert len(lists) == 2

        assert lists[0]['id'] == '1002'
        assert lists[0]['num_bookmarks'] == 4

        assert lists[1]['id'] == '1003'
        assert lists[1]['num_bookmarks'] == 5

    # Record, then Replay Via List
    # ========================================================================
    def test_record_1(self):
        res = self.testapp.get('/_new/temp/rec/record/mp_/http://example.com/')
        assert res.status_code == 302
        res = res.follow()
        res.charset = 'utf-8'

        assert 'Example Domain' in res.text

    def test_replay_1(self):
        res = self.testapp.get('/{user}/temp/list/1002/mp_/http://example.com/'.format(user=self.anon_user), status=200)
        res.charset = 'utf-8'

        assert 'Example Domain' in res.text

        assert 'wbinfo.top_url = "http://localhost:80/{user}/temp/list/1002/http://example.com/"'.format(user=self.anon_user) in res.text, res.text

    # Collection and User Info
    # ========================================================================
    def test_colls_info(self):
        res = self.testapp.get(self._format('/api/v1/collections?user={user}'))

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
        res = self.testapp.get(self._format('/api/v1/users/{user}?include_colls=true'))

        user = res.json['user']

        assert len(user['collections']) == 1
        assert user['collections'][0]['id'] == 'temp'

        for coll in user['collections']:
            assert 'lists' not in coll
            assert 'recordings' not in coll


    # Delete Collection
    # ========================================================================
    def test_delete_coll(self):
        res = self.testapp.delete('/api/v1/collection/temp?user={user}'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'temp'}

        assert len(self.redis.keys('l:*')) == 0
        assert len(self.redis.keys('b:*')) == 0

