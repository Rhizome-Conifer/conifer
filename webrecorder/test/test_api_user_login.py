from .testutils import FullStackTests

from mock import patch
import re


# ============================================================================
class TestApiUserLogin(FullStackTests):
    val_reg = ''

    def test_api_register_fail_mismatch_password(self):
        # mismatch password
        params = {'email': 'test@example.com',
                  'username': 'someuser',
                  'password': 'Password2',
                  'confirmpassword': 'Password1'}

        res = self.testapp.post_json('/api/v1/userreg', params=params)

        assert res.json == {'errors': {'validation': 'Passwords do not match!'}}


    def test_api_register_fail_bad_password(self):
        # bad password
        params = {'email': 'test@example.com',
                  'username': 'someuser',
                  'password': '1',
                  'confirmpassword': '1'
                 }

        res = self.testapp.post_json('/api/v1/userreg', params=params)

        assert res.json == {'errors': {'validation': 'Please choose a different password'}}

    def test_api_register_fail_bad_user(self):
        # bad user
        params = {'email': 'test@example.com',
                  'username': '@#$',
                  'password': 'Password2',
                  'confirmpassword': 'Password1'
                 }

        res = self.testapp.post_json('/api/v1/userreg', params=params)

        assert res.json == {'errors': {'validation': 'The name <b>@#$</b> is not a valid username. Please choose a different username'}}

    @classmethod
    def mock_send_reg_email(cls, sender, title, text):
        cls.val_reg = re.search('/_valreg/([^"]+)', text).group(1)

    def test_api_register_success(self):
        params = {'email': 'test@example.com',
                  'username': 'someuser',
                  'password': 'Password1',
                  'confirmpassword': 'Password1'
                 }

        with patch('cork.Mailer.send_email', self.mock_send_reg_email):
            res = self.testapp.post_json('/api/v1/userreg', params=params)

        assert res.json == {'success': 'A confirmation e-mail has been sent to <b>someuser</b>. Please '
                                       'check your e-mail to complete the registration!'}

    def test_api_val_reg_fail_no_cookie(self):
        params = {'reg': self.val_reg}

        # no cookie, error
        res = self.testapp.post('/api/v1/userval', params=params)
        assert res.json == {'error': 'invalid'}

    def test_api_val_reg_fail_code_mismatch(self):
        params = {'reg': 'foo'}
        headers = {'Cookie': 'valreg=' + self.val_reg}

        # no cookie, error
        res = self.testapp.post('/api/v1/userval', headers=headers, params=params)
        assert res.json == {'error': 'invalid'}

    def test_api_val_reg_success(self):
        params = {'reg': self.val_reg}
        headers = {'Cookie': 'valreg=' + self.val_reg}

        res = self.testapp.post('/api/v1/userval', headers=headers, params=params)

        assert res.json == {'first_coll_name': 'default-collection', 'registered': 'someuser'}

        assert self.testapp.cookies.get('__test_sesh', '') != ''
        #headers['Cookie'] += '; __test_sesh=' + self.testapp.cookies.get('__test_sesh')

        res = self.redis.hgetall('u:someuser:info')
        #res = self.appcont.manager._format_info(res)
        assert res['size'] == 0
        assert res['max_size'] == '1000000000'
        assert res['created_at'] != None

    def test_api_val_reg_fail_already_registered(self):
        params = {'reg': self.val_reg}
        headers = {'Cookie': 'valreg=' + self.val_reg}

        res = self.testapp.post('/api/v1/userval', headers=headers, params=params)
        assert res.json == {'error': 'already_registered'}

    def test_logout(self):
        res = self.testapp.get('/api/v1/logout')

        assert res.headers['Location'] == 'http://localhost:80/'
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_api_register_fail_dupe_user(self):
        # dupe user
        params = {'email': 'test2@example.com',
                  'username': 'someuser',
                  'password': 'Password2',
                  'confirmpassword': 'Password2'
                 }

        res = self.testapp.post_json('/api/v1/userreg', params=params)

        assert res.json == {'errors': {'validation': 'User <b>someuser</b> already exists! Please choose '
                                                     'a different username'}}

    def test_api_register_fail_dupe_email(self):
        # dupe email
        params = {'email': 'test@example.com',
                  'username': 'someuser2',
                  'password': 'Password2',
                  'confirmpassword': 'Password2'
                 }


        res = self.testapp.post_json('/api/v1/userreg', params=params)

        assert res.json == {'errors': {'validation': 'There is already an account for '
                                                     '<b>test@example.com</b>. If you have trouble '
                                                     'logging in, you may <a href="/_forgot"><b>reset the '
                                                     'password</b></a>.'}}

    def test_api_val_reg_fail_already_registered_logged_out(self):
        params = {'reg': self.val_reg}
        headers = {'Cookie': 'valreg=' + self.val_reg}

        res = self.testapp.post('/api/v1/userval', headers=headers, params=params)
        assert res.json == {'error': 'already_registered'}


