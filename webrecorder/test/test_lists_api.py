from .testutils import BaseWRTests, FullStackTests
import time


# ============================================================================
class TestListsAPI(FullStackTests):
    def _format(self, url):
        return url.format(user=self.anon_user)

    def test_create_anon_coll(self):
        res = self.testapp.post(self._format('/api/v1/collections?user={user}'), params={'title': 'Temp'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['collection']['id'] == 'temp'
        assert res.json['collection']['title'] == 'Temp'

        _coll, _ = self.get_coll_rec(self.anon_user, 'temp', '')

        TestListsAPI.coll = _coll

        self.redis.set('c:{coll}:n:list_count'.format(coll=_coll), 1000)

    def test_create_list(self):
        params = {'title': 'New List'}

        res = self.testapp.post_json(self._format('/api/v1/lists?user={user}&coll=temp'), params=params)

        blist = res.json['list']
        assert blist['created_at'] == blist['updated_at']
        assert self.ISO_DT_RX.match(blist['created_at'])
        assert self.ISO_DT_RX.match(blist['updated_at'])

        assert blist['title'] == 'New List'
        assert blist['owner'] == self.coll
        assert blist['id'] == '1001'

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
        res = self.testapp.post_json(self._format('/api/v1/list/1001/move-before?user={user}&coll=temp'), params=params, status=404)

        assert res.json['error_message'] == 'List not found'

    def test_move_list(self):
        params = {'before_id': '1003'}
        res = self.testapp.post_json(self._format('/api/v1/list/1001/move-before?user={user}&coll=temp'), params=params)

        assert res.json == {'success': 'list moved'}

        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))

        lists = res.json['lists']
        assert len(lists) == 3

        assert ['1002', '1001', '1003'] == list(l['id'] for l in lists)
        assert ['New List', 'New List', 'Another List'] == list(l['title'] for l in lists)

    def test_move_list_last(self):
        params = {}

        res = self.testapp.post_json(self._format('/api/v1/list/1002/move-before?user={user}&coll=temp'), params=params)

        assert res.json == {'success': 'list moved'}

        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))

        lists = res.json['lists']
        assert len(lists) == 3

        assert ['1001', '1003', '1002'] == list(l['id'] for l in lists)
        assert ['New List', 'Another List', 'New List'] == list(l['title'] for l in lists)

        scores = self.redis.zrange('c:{coll}:lists'.format(coll=self.coll), 0, -1, withscores=True)
        assert scores == [('1001', 2560.0), ('1003', 3072.0), ('1002', 3584.0)]

    def test_delete_list(self):
        assert len(self.redis.keys('l:1001:*')) > 0

        res = self.testapp.delete(self._format('/api/v1/list/1001?user={user}&coll=temp'))

        assert res.json == {'delete_id': '1001'}
        assert len(self.redis.keys('l:1001:*')) == 0

        res = self.testapp.get(self._format('/api/v1/lists?user={user}&coll=temp'))

        lists = res.json['lists']
        assert len(lists) == 2

        assert ['1003', '1002'] == list(l['id'] for l in lists)
        assert ['Another List', 'New List'] == list(l['title'] for l in lists)

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

    def test_delete_coll(self):
        res = self.testapp.delete('/api/v1/collections/temp?user={user}'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'temp'}
        assert len(self.redis.keys('l:*')) == 0

