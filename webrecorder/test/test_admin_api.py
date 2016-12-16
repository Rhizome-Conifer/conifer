from .testutils import FullStackTests

from webrecorder.redisman import init_manager_for_cli


class TestAdminAPI(FullStackTests):

    def test_cli_manager(self):
        m = init_manager_for_cli()

        assert type(m.redis.keys('*')) is list

    def test_admin_no_auth(self):
        res = self.testapp.get('/api/v1/users')
        # no permissions, redirect to _login
        assert res.headers['Location'].endswith('_login')
