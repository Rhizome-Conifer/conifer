from .testfullstack import FullStackTests


class TestAdminAPI(FullStackTests):

    def test_admin_no_auth(self):
        res = self.testapp.get('/api/v1/users')
        # no permissions, redirect to _login
        assert res.headers['Location'].endswith('_login')
