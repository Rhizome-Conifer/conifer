import time
import os
import re

from mock import patch

from .testutils import BaseWRTests


# ============================================================================
class TestLogin(BaseWRTests):
    @classmethod
    def setup_class(cls):
        os.environ['WEBAGG_HOST'] = 'http://localhost:8080'
        os.environ['RECORD_HOST'] = 'http://localhost:8010'
        cls.val_reg = ''

        super(TestLogin, cls).setup_class()

    def test_req_invite(self):
        params = {'email': 'test@example.com',
                  'name': 'Testy Test',
                  'desc': 'Test Desc'}

        res = self.testapp.post('/_invite', params=params)
        assert res.status_code == 302

    @classmethod
    def mock_send_invite_email(cls, sender, title, text):
        cls.invite_key = re.search('invite=([^"]+)', text).group(1)

    def test_send_invite(self):
        m = self.appcont.manager

        email_template = 'webrecorder/templates/emailinvite.html'

        with patch('cork.Mailer.send_email', self.mock_send_invite_email):
            res = m.send_invite('test@example.com',
                                email_template=email_template,
                                host='https://webrecorder.io')

        assert res == True
        assert self.invite_key != ''

        # not found
        with patch('cork.Mailer.send_email', self.mock_send_invite_email):
            res = m.send_invite('test2@example.com',
                                email_template=email_template,
                                host='https://webrecorder.io')

        assert res == False

    def test_register_get(self):
        res = self.testapp.get('/_register')
        res.charset = 'utf-8'

        assert 'Webrecorder Invite Request' in res.text

        res = self.testapp.get('/_register?invite=blah')
        res.charset = 'utf-8'

        assert 'Webrecorder Invite Request' in res.text

        res = self.testapp.get('/_register?invite=' + self.invite_key)
        res.charset = 'utf-8'

        assert 'Webrecorder Account Sign-Up' in res.text

    def test_register_post_fail(self):
        # wrong email
        params = {'email': 'test2@example.com',
                  'username': 'someuser',
                  'password': 'Password1',
                  'confirmpassword': 'Password1',
                  'invite': self.invite_key}

        res = self.testapp.post('/_register', params=params)

        assert res.headers['Location'] == 'http://localhost:80/_register'

        # mismatch password
        params = {'email': 'test@example.com',
                  'username': 'someuser',
                  'password': 'Password2',
                  'confirmpassword': 'Password1',
                  'invite': self.invite_key}

        res = self.testapp.post('/_register', params=params)

        assert res.headers['Location'] == 'http://localhost:80/_register?invite=' + self.invite_key

        # bad password
        params = {'email': 'test@example.com',
                  'username': 'someuser',
                  'password': '1',
                  'confirmpassword': '1',
                  'invite': self.invite_key}

        res = self.testapp.post('/_register', params=params)

        assert res.headers['Location'] == 'http://localhost:80/_register?invite=' + self.invite_key

        # bad user
        params = {'email': 'test@example.com',
                  'username': '@#$',
                  'password': 'Password2',
                  'confirmpassword': 'Password1',
                  'invite': self.invite_key}

        res = self.testapp.post('/_register', params=params)

        assert res.headers['Location'] == 'http://localhost:80/_register?invite=' + self.invite_key

        # wrong key
        params = {'email': 'test@example.com',
                  'username': '@#$',
                  'password': 'Password2',
                  'confirmpassword': 'Password1',
                  'invite': 'foo'}

        res = self.testapp.post('/_register', params=params)

        assert res.headers['Location'] == 'http://localhost:80/_register'

    @classmethod
    def mock_send_reg_email(cls, sender, title, text):
        cls.val_reg = re.search('/_valreg/([^"]+)', text).group(1)

    def test_register_post_success(self):
        params = {'email': 'test@example.com',
                  'username': 'someuser',
                  'password': 'Password1',
                  'confirmpassword': 'Password1',
                  'invite': self.invite_key}

        with patch('cork.Mailer.send_email', self.mock_send_reg_email):
            res = self.testapp.post('/_register', params=params)

        assert res.headers['Location'] == 'http://localhost:80/'


    def test_register_post_fail_dupe(self):
        params = {'password': 'Password1',
                  'confirmpassword': 'Password1',
                  'invite': self.invite_key}

        # same user
        params['email'] = 'test2@example.com'
        params['user'] = 'someuser'
        res = self.testapp.post('/_register', params=params)
        assert res.headers['Location'] == 'http://localhost:80/_register'

        # same email
        params['email'] = 'test@example.com'
        params['user'] = 'someuser2'
        res = self.testapp.post('/_register', params=params)
        assert res.headers['Location'] == 'http://localhost:80/_register'

    def test_val_user_reg(self):
        res = self.testapp.get('/_valreg/' + self.val_reg)
        assert self.val_reg in res.text

        params = {'reg': self.val_reg}
        headers = {'Cookie': 'valreg=' + self.val_reg}

        # no cookie, error
        res = self.testapp.post('/_valreg', params=params)
        assert res.headers['Location'] == 'http://localhost:80/_register'

        res = self.testapp.post('/_valreg', headers=headers, params=params)
        assert res.headers['Location'] == 'http://localhost:80/'

        assert self.testapp.cookies.get('__test_sesh', '') != ''

        headers['Cookie'] += '; __test_sesh=' + self.testapp.cookies.get('__test_sesh')

        # already validated, logged in, so ignore
        res = self.testapp.post('/_valreg', headers=headers, params=params)
        assert res.headers['Location'] == 'http://localhost:80/'

        res = self.redis.hgetall('u:someuser:info')
        res = self.appcont.manager._format_info(res)
        assert res['size'] == 0
        assert res['max_size'] == '1000000000'
        assert res['max_coll'] == '10'
        assert res['created_at'] != None

    def test_logout(self):
        res = self.testapp.get('/_logout')
        assert res.headers['Location'] == 'http://localhost:80/'
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_invalid_val_reg(self):
        # already validated
        params = {'reg': self.val_reg}
        res = self.testapp.post('/_valreg', params=params)
        assert res.headers['Location'] == 'http://localhost:80/_register'

        # invalid valreg
        params = {'reg': 'blah'}
        res = self.testapp.post('/_valreg', params=params)
        assert res.headers['Location'] == 'http://localhost:80/_register'

    def test_login(self):
        res = self.testapp.get('/_login')
        assert b'Login' in res.body

        params = {'username': 'someuser', 'password': 'Password1'}
        res = self.testapp.post('/_login', params=params)
        assert res.headers['Location'] == 'http://localhost:80/someuser'
        assert self.testapp.cookies.get('__test_sesh', '') != ''

    def test_logout_2(self):
        res = self.testapp.get('/_logout')
        assert res.headers['Location'] == 'http://localhost:80/'
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    @classmethod
    def mock_send_forgot_email(cls, sender, title, text):
        groups = re.search('(/_resetpassword/([^"]+))', text).groups()
        cls.reset_password_url = groups[0]
        cls.reset_code = groups[1]

    def test_forgot(self):
        res = self.testapp.get('/_forgot')
        assert b'Reset' in res.body

        # invalid username and email
        params = {'username': 'foo', 'email': 'bar'}
        res = self.testapp.post('/_forgot', params=params)
        assert res.headers['Location'] == 'http://localhost:80/_forgot'

    def test_reset_by_email(self):
        TestLogin.reset_password_url = None
        TestLogin.reset_code = None

        # reset by email
        params = {'email': 'test@example.com'}
        with patch('cork.Mailer.send_email', self.mock_send_forgot_email):
            res = self.testapp.post('/_forgot', params=params)

        # valid reset
        assert res.headers['Location'] == 'http://localhost:80/'
        assert TestLogin.reset_code != None
        assert TestLogin.reset_password_url != None


    def test_reset_by_username(self):
        TestLogin.reset_password_url = None
        TestLogin.reset_code = None

        # reset by username
        params = {'username': 'someuser', 'email': ''}
        with patch('cork.Mailer.send_email', self.mock_send_forgot_email):
            res = self.testapp.post('/_forgot', params=params)

        # valid reset
        assert res.headers['Location'] == 'http://localhost:80/'
        assert TestLogin.reset_code != None
        assert TestLogin.reset_password_url != None

    def test_reset_code_invalid(self):
        # invalid reset
        res = self.testapp.get('/_resetpassword/abc')
        assert res.headers['Location'] == 'http://localhost:80/_forgot'

    def test_reset_code_valid(self):
        # valid reset
        res = self.testapp.get(self.reset_password_url)
        assert res.status_code == 200
        assert 'Please enter a new password below' in res.text

    def test_do_reset_password_invalid(self):
        # wrong key
        params = {'username': 'someuser',
                  'password': 'Password2',
                  'confirmpassword': 'Password2',
                  'resetcode': 'foo'}

        res = self.testapp.post('/_resetpassword', params=params)
        assert res.headers['Location'] == 'http://localhost:80/_forgot'

        # mismatch password
        params = {'username': 'someuser',
                  'password': 'Password2',
                  'confirmpassword': 'Password3',
                  'resetcode': self.reset_code}

        res = self.testapp.post('/_resetpassword', params=params)
        #assert res.headers['Location'] == 'http://localhost:80' + self.reset_password_url
        assert res.headers['Location'].startswith('http://localhost:80/_resetpassword/')

    def test_do_reset_success(self):
        params = {'username': 'someuser',
                  'password': 'Password3',
                  'confirmpassword': 'Password3',
                  'resetcode': self.reset_code}

        res = self.testapp.post('/_resetpassword', params=params)
        assert res.headers['Location'] == 'http://localhost:80/_login'

    def test_login_2(self):
        params = {'username': 'someuser',
                  'password': 'Password3'}

        res = self.testapp.post('/_login', params=params)

        assert res.headers['Location'] == 'http://localhost:80/someuser'
        assert self.testapp.cookies.get('__test_sesh', '') != ''


