from .testutils import BaseWRTests, FullStackTests
from webrecorder.models.usermanager import CLIUserManager
from webrecorder.utils import sanitize_title


# ============================================================================
class TestListsAPIAccess(FullStackTests):
    pub_list_priv_coll = None
    priv_list_priv_coll = None
    pub_list_pub_coll = None
    priv_list_pub_coll = None

    @classmethod
    def setup_class(cls):
        super(TestListsAPIAccess, cls).setup_class(init_anon=False)

        cls.user_manager = CLIUserManager()

    def test_init_users(self):
        self.user_manager.create_user('test@example.com', 'test', 'TestTest123', 'archivist', 'Test')

        self.user_manager.create_user('test2@example.com', 'another', 'TestTest456', 'archivist', 'Another Test')

        assert len(self.redis.keys('u:*:info')) == 2

    def _create_coll(self, user, coll_title, public=False):
        # Collection
        params = {'title': coll_title,
                  'public': public}

        coll_name = sanitize_title(coll_title)

        res = self.testapp.post_json('/api/v1/collections?user={0}'.format(user), params=params)
        collection = res.json['collection']

        if public:
            assert collection['r:@public'] == '1'
        else:
            assert 'r:@public' not in collection

        return coll_name

    def _create_list(self, user, coll_name, list_name='New List', public=False):
        # List
        params = {'title': list_name,
                  'desc': 'List Description Goes Here!',
                  'public': public,
                 }

        res = self.testapp.post_json('/api/v1/lists?user={0}&coll={1}'.format(user, coll_name), params=params)

        assert res.json['list']
        list_id = res.json['list']['id']
        assert res.json['list']['public'] == public

        # Bookmark
        params = {'title': 'A Bookmark',
                  'url': 'http://example.com/',
                  'timestamp': '2017',
                 }

        res = self.testapp.post_json('/api/v1/list/%s/bookmarks?user={0}&coll=some-coll'.format(user) % list_id, params=params)
        assert res.json['bookmark']

        return list_id

    def test_login_first_user(self):
        params = {'username': 'test',
                  'password': 'TestTest123',
                 }

        res = self.testapp.post_json('/api/v1/login', params=params)
        assert res.json['username'] == 'test'
        assert self.testapp.cookies['__test_sesh'] != ''

    def test_create_all_user_1(self):
        coll_name = self._create_coll('test', 'Some Coll', public=False)
        self.priv_list_priv_coll = self._create_list('test', coll_name, 'New List', public=False)
        self.pub_list_priv_coll = self._create_list('test', coll_name, 'Public List', public=True)

    def test_logout_login_user_2(self):
        res = self.testapp.get('/api/v1/logout', status=200)

        params = {'username': 'another',
                  'password': 'TestTest456',
                 }

        res = self.testapp.post_json('/api/v1/login', params=params)
        assert res.json['username'] == 'another'
        assert self.testapp.cookies['__test_sesh'] != ''

    def test_create_all_user_2(self):
        coll_name = self._create_coll('another', 'Some Coll', public=True)
        TestListsAPIAccess.priv_list_pub_coll = self._create_list('another', coll_name, 'A List', public=False)
        TestListsAPIAccess.pub_list_pub_coll = self._create_list('another', coll_name, 'Public List', public=True)

        res = self.testapp.get('/api/v1/lists?user=another&coll=some-coll')
        assert len(res.json['lists']) == 2

    def test_assert_data_model(self):
        assert len(self.redis.keys('u:*:info')) == 2

        assert len(self.redis.keys('c:*:info')) == 4
        assert set(self.redis.hkeys('u:test:colls')) == {'some-coll', 'default-collection'}
        assert set(self.redis.hkeys('u:another:colls')) == {'some-coll', 'default-collection'}

        assert len(self.redis.keys('l:*:info')) == 4
        assert len(self.redis.keys('b:*:info')) == 4

    def test_no_lists_user_info(self):
        # wrong user
        res = self.testapp.get('/api/v1/users/test', status=404)

        res = self.testapp.get('/api/v1/users/another')

        assert len(res.json['user']['collections']) == 2
        for coll in res.json['user']['collections']:
            assert 'lists' not in coll

    def test_set_featured_list(self):
        params = {'featured_list': self.priv_list_priv_coll}
        res = self.testapp.post_json('/api/v1/collection/some-coll?user=another', params=params, status=400)
        assert res.json['error'] == 'no_such_list'

        params = {'featured_list': self.pub_list_pub_coll}
        res = self.testapp.post_json('/api/v1/collection/some-coll?user=another', params=params)
        assert res.json['collection']['featured_list'] == self.pub_list_pub_coll

    def test_public_list_private_coll_error_logged_in(self):
        res = self.testapp.get('/api/v1/lists?user=test&coll=some-coll', status=404)

    def test_public_list_private_coll_error_logged_out(self):
        res = self.testapp.get('/api/v1/logout')

        res = self.testapp.get('/api/v1/lists?user=test&coll=some-coll', status=404)

    def test_public_lists_only_logged_out(self):
        res = self.testapp.get('/api/v1/lists?user=another&coll=some-coll')
        assert len(res.json['lists']) == 1
        assert res.json['lists'][0]['title'] == 'Public List'

        res = self.testapp.get('/api/v1/collection/some-coll?user=another')
        assert len(res.json['collection']['lists']) == 1
        assert res.json['collection']['lists'][0]['title'] == 'Public List'
        assert res.json['collection']['featured_list'] == self.pub_list_pub_coll

    def test_get_list_by_id_logged_out(self):
        res = self.testapp.get('/api/v1/list/{0}?user=another&coll=some-coll'.format(self.priv_list_pub_coll), status=404)
        res = self.testapp.get('/api/v1/list/{0}?user=another&coll=some-coll'.format(self.pub_list_pub_coll), status=200)
        res = self.testapp.get('/api/v1/list/{0}?user=test&coll=some-coll'.format(self.priv_list_priv_coll), status=404)
        res = self.testapp.get('/api/v1/list/{0}?user=test&coll=some-coll'.format(self.pub_list_priv_coll), status=404)

    def test_update_list_by_id_logged_out(self):
        res = self.testapp.post_json('/api/v1/list/{0}?user=another&coll=some-coll'.format(self.priv_list_pub_coll), status=404, params={'title': 'Foo'})
        res = self.testapp.post_json('/api/v1/list/{0}?user=another&coll=some-coll'.format(self.pub_list_pub_coll), status=404, params={'title': 'Foo'})

    def test_login_first_user_again(self):
        params = {'username': 'test',
                  'password': 'TestTest123',
                 }

        res = self.testapp.post_json('/api/v1/login', params=params)
        assert res.json['username'] == 'test'
        assert self.testapp.cookies['__test_sesh'] != ''

    def test_public_lists_only_logged_in_diff_user(self):
        res = self.testapp.get('/api/v1/lists?user=another&coll=some-coll')
        assert len(res.json['lists']) == 1
        assert res.json['lists'][0]['title'] == 'Public List'

        res = self.testapp.get('/api/v1/collection/some-coll?user=another')
        assert len(res.json['collection']['lists']) == 1
        assert res.json['collection']['lists'][0]['title'] == 'Public List'
        assert res.json['collection']['featured_list'] == self.pub_list_pub_coll

    def test_get_list_by_id_logged_in_diff_user(self):
        res = self.testapp.get('/api/v1/list/{0}?user=another&coll=some-coll'.format(self.priv_list_pub_coll), status=404)
        res = self.testapp.get('/api/v1/list/{0}?user=another&coll=some-coll'.format(self.pub_list_pub_coll), status=200)
        res = self.testapp.get('/api/v1/list/{0}?user=test&coll=some-coll'.format(self.priv_list_priv_coll), status=404)
        res = self.testapp.get('/api/v1/list/{0}?user=test&coll=some-coll'.format(self.pub_list_priv_coll), status=404)

    def test_update_list_by_id_logged_in_diff_user(self):
        res = self.testapp.post_json('/api/v1/list/{0}?user=another&coll=some-coll'.format(self.priv_list_pub_coll), status=404, params={'title': 'Foo'})
        res = self.testapp.post_json('/api/v1/list/{0}?user=another&coll=some-coll'.format(self.pub_list_pub_coll), status=404, params={'title': 'Foo'})


