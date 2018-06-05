from .testutils import FullStackTests

from webrecorder.models.usermanager import CLIUserManager
from webrecorder.utils import today_str


# ============================================================================
class TestAdminAPI(FullStackTests):
    @classmethod
    def setup_class(cls):
        super(TestAdminAPI, cls).setup_class()
        cls.user_manager = CLIUserManager()

    def test_no_auth_admin_users(self):
        res = self.testapp.get('/api/v1/admin/users', status=404)
        # no permissions, just display 404
        assert res.json == {'error': 'not_found'}

    def test_no_auth_admin_dashboard(self):
        res = self.testapp.get('/api/v1/admin/dashboard', status=404)
        # no permissions, just display 404
        assert res.json == {'error': 'not_found'}

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

        res = self.testapp.post_json('/api/v1/auth/login', params=params)
        assert res.json['username'] == 'adminuser'
        assert self.testapp.cookies['__test_sesh'] != ''

    def test_api_roles(self):
        res = self.testapp.get('/api/v1/admin/user_roles')
        assert set(res.json['roles']) == {'admin',
                                          'beta-archivist',
                                          'mounts-archivist',
                                          'public-archivist',
                                          'archivist'}

    def test_get_api_defaults(self):
        res = self.testapp.get('/api/v1/admin/defaults')
        assert res.json == {'defaults': {'max_anon_size': 1000000000, 'max_size': 1000000000}}

    def test_set_api_defaults(self):
        res = self.testapp.put_json('/api/v1/admin/defaults', params={'max_size': 7000000000})
        assert res.json == {'defaults': {'max_anon_size': 1000000000, 'max_size': 7000000000}}

        # raw key, not converted to int
        assert self.redis.hgetall('h:defaults') == {'max_anon_size': '1000000000', 'max_size': '7000000000'}

    def test_api_users(self):
        res = self.testapp.get('/api/v1/admin/users')
        assert [user['username'] for user in res.json['users']] == ['adminuser', 'test']
        assert [user['role'] for user in res.json['users']] == ['admin', 'archivist']
        assert [user['name'] for user in res.json['users']] == ['Test Admin', 'Test User']
        assert [user['max_size'] for user in res.json['users']] == ['1000000000', '1000000000']

    def test_api_temp_users(self):
        res = self.testapp.get('/api/v1/admin/temp-users')
        assert [user['username'] for user in res.json['users']] == [self.anon_user]
        assert [user.get('role') for user in res.json['users']] == [None]
        assert [user.get('name') for user in res.json['users']] == [None]
        assert [user['max_size'] for user in res.json['users']] == ['1000000000']

    def test_api_create_user_errors(self):
        params = {'email': 'another@example.com',
                  'username': 'test',
                  'password': 'TestTest',
                  'role': 'archivist2',
                  'name': 'Another User'}

        res = self.testapp.post_json('/api/v1/admin/users', params=params)

        assert res.json == {'errors': ['Username already exists.',
                                       'Not a valid role.',
                                       'Passwords must match and be at least 8 characters long with '
                                       'lowercase, uppercase, and either digits or symbols.']}


    def test_api_create_user(self):
        params = {'email': 'another@example.com',
                  'username': 'another',
                  'password': 'TestTest789',
                  'role': 'archivist',
                  'name': 'Another User'}

        res = self.testapp.post_json('/api/v1/admin/users', params=params)

        assert res.json == {'first_coll': 'default-collection', 'user': 'another'}

    def test_api_users_added(self):
        res = self.testapp.get('/api/v1/admin/users')
        assert [user['username'] for user in res.json['users']] == ['adminuser', 'another', 'test']
        assert [user['role'] for user in res.json['users']] == ['admin', 'archivist', 'archivist']
        assert [user['name'] for user in res.json['users']] == ['Test Admin', 'Another User', 'Test User']
        assert [user['max_size'] for user in res.json['users']] == ['1000000000', '7000000000', '1000000000']

    def test_update_user_error_invalid_role_and_size(self):
        params = {'role': 'beta-arc',
                  'max_size': '500000000',
                  'desc': 'Custom Desc'
                 }

        res = self.testapp.put_json('/api/v1/admin/user/test', params=params)
        assert res.json == {'errors': ['Not a valid role.', 'max_size must be an int']}

    def test_update_user(self):
        params = {'role': 'beta-archivist',
                  'max_size': 200000000,
                  'desc': 'Custom Desc'
                 }

        res = self.testapp.put_json('/api/v1/admin/user/test', params=params)

        assert res.json['user']['space_utilization'] == {'available': 200000000, 'total': 200000000, 'used': 0}
        assert res.json['user']['role'] == 'beta-archivist'
        assert res.json['user']['name'] == 'Test User'
        assert res.json['user']['desc'] == 'Custom Desc'

    def test_api_stats_search(self):
        res = self.testapp.post('/api/v1/stats/search')

        assert isinstance(res.json, list)
        assert 'All Capture Logged In' in res.json
        assert 'All Capture Temp' in res.json
        assert 'Temp Table' in res.json
        assert 'User Table' in res.json

    def test_api_stats_query_timeseries(self):
        params = {'range': {'from': today_str(),
                            'to': today_str()
                           },
                  'targets': [{'target': 'All Capture Logged In', 'type': 'timeserie'},
                              {'target': 'All Capture Temp', 'type': 'timeserie'},
                              {'target': 'not_found', 'type': 'timeserie'},
                             ]
                 }

        res = self.testapp.post_json('/api/v1/stats/query', params=params)

        assert isinstance(res.json, list)
        assert len(res.json) == 3

    def test_api_stats_query_users(self):
        params = {'range': {'from': today_str(),
                            'to': today_str()
                           },
                  'targets': [{'target': 'User Table', 'type': 'table'},
                             ]
                 }

        res = self.testapp.post_json('/api/v1/stats/query', params=params)

        assert isinstance(res.json, list)
        assert len(res.json) == 1
        data = res.json[0]

        assert len(data['rows']) == 3

        assert set(data[0] for data in data['rows']) == {'test', 'another', 'adminuser'}

    def test_api_stats_query_temps(self):
        params = {'range': {'from': today_str(),
                            'to': today_str()
                           },
                  'targets': [{'target': 'Temp Table', 'type': 'table'},
                              {'target': 'not found', 'type': 'table'},
                             ]
                 }

        res = self.testapp.post_json('/api/v1/stats/query', params=params)

        assert isinstance(res.json, list)
        assert len(res.json) == 2
        assert res.json[1] == {}
        data = res.json[0]

        assert len(data['rows']) == 1

        assert set(data[0] for data in data['rows']) == {self.anon_user}

