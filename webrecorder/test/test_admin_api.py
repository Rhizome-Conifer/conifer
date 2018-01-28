from .testutils import FullStackTests

from webrecorder.models.usermanager import CLIUserManager

class TestAdminAPI(FullStackTests):

    def test_cli_manager(self):
        m = CLIUserManager()

        assert type(m.redis.keys('*')) is list

    def test_admin_no_auth(self):
        res = self.testapp.get('/api/v1/users')
        # no permissions, redirect to _login
        assert res.headers['Location'].endswith('_login')

    def test_client_archives(self):
        res = self.testapp.get('/api/v1/client_archives/')

        assert len(list(res.json.keys())) == 25

        for key, value in res.json.items():
            assert 'name' in value
            assert 'about' in value
            assert 'prefix' in value

