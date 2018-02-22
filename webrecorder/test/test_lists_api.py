from .testutils import BaseWRTests, FullStackTests
import time


# ============================================================================
class TestListsAPI(FullStackTests):
    def _format(self, url):
        return url.format(user=self.anon_user)

    def _add_bookmark(self, list_id, title,
                      url='http://example.com/',
                      timestamp='20181226000800',
                      browser='chrome:60'):

        params = {'title': title,
                  'url': url,
                  'ts': timestamp,
                  'browser': browser,
                 }

        res = self.testapp.post_json(self._format('/api/v1/list/%s/bookmarks?user={user}&coll=temp' % list_id), params=params)
        assert res.json['bookmark']
        return res

    def test_create_anon_coll(self):
        res = self.testapp.post(self._format('/api/v1/collections?user={user}'), params={'title': 'Temp'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['collection']['id'] == 'temp'
        assert res.json['collection']['title'] == 'Temp'

        _coll, _ = self.get_coll_rec(self.anon_user, 'temp', '')

        TestListsAPI.coll = _coll

        self.redis.set('c:{coll}:n:list_count'.format(coll=_coll), 1000)
        self.redis.set('c:{coll}:n:bookmark_count'.format(coll=_coll), 100)

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

        assert self.redis.get('c:{coll}:n:list_count'.format(coll=self.coll)) == '1001'

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
        assert bookmark['ts'] == '20181226000800'
        assert bookmark['browser'] == 'chrome:60'

        assert self.redis.get('c:{coll}:n:bookmark_count'.format(coll=self.coll)) == '101'

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
                  'ts': '201701'
                 }

        res = self.testapp.post_json(self._format('/api/v1/bookmark/104?user={user}&coll=temp&list=1002'), params=params)

        bookmark = res.json['bookmark']
        assert bookmark['id'] == '104'
        assert bookmark['title'] == 'A New Title?'
        assert bookmark['ts'] == '201701'

    def test_get_lists_with_bookmarks(self):
        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))
        assert len(res.json['lists']) == 2

        assert res.json['lists'][0]['id'] == '1002'
        assert len(res.json['lists'][0]['bookmarks']) == 4

        assert res.json['lists'][0]['bookmarks'][2]['id'] == '105'
        assert res.json['lists'][0]['bookmarks'][2]['title'] == 'Some Other Example'

        assert res.json['lists'][0]['bookmarks'][1]['id'] == '104'
        assert res.json['lists'][0]['bookmarks'][1]['title'] == 'A New Title?'

    def test_coll_info_with_lists(self):
        res = self.testapp.get(self._format('/api/v1/collections/temp?user={user}'))

        lists = res.json['collection']['lists']

        assert len(lists) == 2

        assert lists[0]['id'] == '1002'
        assert lists[0]['num_bookmarks'] == 4

        assert lists[1]['id'] == '1003'
        assert lists[1]['num_bookmarks'] == 2

    def test_delete_coll(self):
        res = self.testapp.delete('/api/v1/collections/temp?user={user}'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'temp'}

        assert len(self.redis.keys('l:*')) == 0
        assert len(self.redis.keys('b:*')) == 0

