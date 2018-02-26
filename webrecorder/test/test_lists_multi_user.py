from .testutils import BaseWRTests, FullStackTests
from webrecorder.models.usermanager import CLIUserManager


# ============================================================================
class TestListsAPIAccess(FullStackTests):
    @classmethod
    def setup_class(cls):
        super(TestListsAPIAccess, cls).setup_class(init_anon=False)

        cls.user_manager = CLIUserManager()

    def test_init_users(self):
        self.user_manager.create_user('test@example.com', 'test', 'TestTest123', 'archivist', 'Test')

        self.user_manager.create_user('test2@example.com', 'another', 'TestTest456', 'archivist', 'Another Test')

        assert len(self.redis.keys('u:*:info')) == 2

    def _create_all(self, user):
        # Collection
        res = self.testapp.post('/api/v1/collections?user={0}'.format(user), params={'title': 'Some Coll'})
        assert res.json['collection']

        # List
        params = {'title': 'New List',
                  'desc': 'List Description Goes Here!'
                 }

        res = self.testapp.post_json('/api/v1/lists?user={0}&coll=some-coll'.format(user), params=params)

        assert res.json['list']
        list_id = res.json['list']['id']

        # Bookmark
        params = {'title': 'A Bookmark',
                  'url': 'http://example.com/',
                  'timestamp': '2017',
                 }

        res = self.testapp.post_json('/api/v1/list/%s/bookmarks?user={0}&coll=some-coll'.format(user) % list_id, params=params)
        assert res.json['bookmark']

    def test_login_first_user(self):
        params = {'username': 'test',
                  'password': 'TestTest123',
                 }

        res = self.testapp.post_json('/api/v1/login', params=params)
        assert res.json['username'] == 'test'
        assert self.testapp.cookies['__test_sesh'] != ''

    def test_create_all_user_1(self):
        self._create_all('test')

    def test_logout_login_user_2(self):
        res = self.testapp.get('/api/v1/logout')

        assert res.headers['Location'] == 'http://localhost:80/'

        params = {'username': 'another',
                  'password': 'TestTest456',
                 }

        res = self.testapp.post_json('/api/v1/login', params=params)
        assert res.json['username'] == 'another'
        assert self.testapp.cookies['__test_sesh'] != ''

    def test_create_all_user_2(self):
        self._create_all('another')

    def test_assert_data_model(self):
        assert len(self.redis.keys('u:*:info')) == 2

        assert len(self.redis.keys('c:*:info')) == 4
        assert set(self.redis.hkeys('u:test:colls')) == {'some-coll', 'default-collection'}
        assert set(self.redis.hkeys('u:another:colls')) == {'some-coll', 'default-collection'}

        assert len(self.redis.keys('l:*:info')) == 2
        assert len(self.redis.keys('b:*:info')) == 2



