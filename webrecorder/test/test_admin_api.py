from .testutils import FullStackTests

from webrecorder.models.usermanager import CLIUserManager

class TestAdminAPI(FullStackTests):
    @classmethod
    def setup_class(cls):
        super(TestAdminAPI, cls).setup_class()
        cls.user_manager = CLIUserManager()

    def test_no_auth_admin_users(self):
        res = self.testapp.get('/api/v1/users')
        # no permissions, redirect to _login
        assert res.headers['Location'].endswith('_login')

    def test_no_auth_admin_dashboard(self):
        res = self.testapp.get('/api/v1/dashboard')
        assert res.headers['Location'].endswith('_login')

    def test_no_auth_client_archives(self):
        res = self.testapp.get('/api/v1/client_archives/')

        assert len(list(res.json.keys())) == 25

        for key, value in res.json.items():
            assert 'name' in value
            assert 'about' in value
            assert 'prefix' in value

    def test_create_login_admin(self):
        self.user_manager.create_user('admin@example.com', 'adminuser', 'TestTest123', 'admin', 'Test Admin')
        self.user_manager.create_user('user@example.com', 'test', 'TestTest456', 'archivist', 'Test User')

        assert len(self.redis.keys('u:*:info')) == 3

    def test_login_first_user(self):
        params = {'username': 'adminuser',
                  'password': 'TestTest123',
                 }

        res = self.testapp.post_json('/api/v1/login', params=params)
        assert res.json['username'] == 'adminuser'
        assert self.testapp.cookies['__test_sesh'] != ''

    def test_api_settings(self):
        res = self.testapp.get('/api/v1/settings')
        assert res.json == {'defaults': {}}

    def test_api_users(self):
        res = self.testapp.get('/api/v1/users')
        assert [user['username'] for user in res.json['users']] == ['adminuser', 'test']
        assert [user['role'] for user in res.json['users']] == ['admin', 'archivist']
        assert [user['name'] for user in res.json['users']] == ['Test Admin', 'Test User']

    def test_api_temp_users(self):
        res = self.testapp.get('/api/v1/temp-users')
        assert [user['username'] for user in res.json['users']] == [self.anon_user]
        assert [user.get('role') for user in res.json['users']] == [None]
        assert [user.get('name') for user in res.json['users']] == [None]

    def test_api_create_user(self):
        params = {'email': 'another@example.com',
                  'username': 'another',
                  'password': 'TestTest789',
                  'role': 'archivist',
                  'name': 'Another User'}

        res = self.testapp.post_json('/api/v1/users', params=params)

        assert res.json == {'first_coll': 'default-collection', 'user': 'another'}

    def test_api_users_added(self):
        res = self.testapp.get('/api/v1/users')
        assert [user['username'] for user in res.json['users']] == ['adminuser', 'another', 'test']
        assert [user['role'] for user in res.json['users']] == ['admin', 'archivist', 'archivist']
        assert [user['name'] for user in res.json['users']] == ['Test Admin', 'Another User', 'Test User']

    def test_update_user(self):
        params = {'role': 'beta-archivist',
                  'max_size': 500000000,
                  'desc': 'Custom Desc'
                 }

        res = self.testapp.put_json('/api/v1/users/test', params=params)

        assert res.json['user']['space_utilization'] == {'available': 500000000, 'total': 500000000, 'used': 0}
        assert res.json['user']['role'] == 'beta-archivist'
        assert res.json['user']['name'] == 'Test User'
        assert res.json['user']['desc'] == 'Custom Desc'



