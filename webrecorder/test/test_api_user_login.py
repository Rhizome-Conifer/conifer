from .testutils import FullStackTests

from mock import patch
import re


# ============================================================================
class TestApiUserLogin(FullStackTests):
    val_reg = ''

    def test_api_temp_user_info(self):
        res = self.testapp.get('/api/v1/user/{user}'.format(user=self.anon_user))

        user = res.json['user']

        assert user['username'] == self.anon_user
        assert user['id'] == self.anon_user
        assert user['space_utilization'] == {'available': 1000000000.0,
                                             'total': 1000000000.0,
                                             'used': 0.0}

        assert self.ISO_DT_RX.match(user['created_at'])
        assert self.ISO_DT_RX.match(user['updated_at'])

        assert set(user.keys()) == {'id', 'username', 'created_at', 'updated_at', 'space_utilization', 'ttl', 'max_size', 'size', 'timespan', 'collections'}

    def test_api_wrong_temp_user_info(self):
        res = self.testapp.get('/api/v1/user/temp-ABC', status=404)

        assert res.json == {'error': 'no_such_user'}

    def test_api_register_fail_mismatch_password(self):
        # mismatch password
        params = {'email': 'test@example.com',
                  'username': 'someuser',
                  'password': 'Password2',
                  'confirmpassword': 'Password1'}

        res = self.testapp.post_json('/api/v1/auth/register', params=params, status=400)

        assert res.json == {'errors': {'validation': 'password_mismatch'}}


    def test_api_register_fail_bad_password(self):
        # bad password
        params = {'email': 'test@example.com',
                  'username': 'someuser',
                  'password': '1',
                  'confirmpassword': '1'
                 }

        res = self.testapp.post_json('/api/v1/auth/register', params=params, status=400)

        assert res.json == {'errors': {'validation': 'password_invalid'}}

    def test_api_register_fail_bad_user(self):
        # bad user
        params = {'email': 'test@example.com',
                  'username': '@#$',
                  'password': 'Password2',
                  'confirmpassword': 'Password1'
                 }

        res = self.testapp.post_json('/api/v1/auth/register', params=params, status=400)

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
            res = self.testapp.post_json('/api/v1/auth/register', params=params)

        assert res.json == {'success': 'A confirmation e-mail has been sent to <b>someuser</b>. Please '
                                       'check your e-mail to complete the registration!'}

    def test_api_val_reg_fail_no_cookie(self):
        params = {'reg': self.val_reg}

        # no cookie, error
        res = self.testapp.post('/api/v1/auth/validate', params=params, status=400)
        assert res.json == {'error': 'invalid_code'}

    def test_api_val_reg_fail_code_mismatch(self):
        params = {'reg': 'foo'}
        headers = {'Cookie': 'valreg=' + self.val_reg}

        # no cookie, error
        res = self.testapp.post('/api/v1/auth/validate', headers=headers, params=params, status=400)
        assert res.json == {'error': 'invalid_code'}

    def test_check_username_avail(self):
        # still available until registration validated
        res = self.testapp.get('/api/v1/auth/check_username/someuser')

        assert res.json == {'available': True}

    def test_api_val_reg_success(self):
        params = {'reg': self.val_reg}
        headers = {'Cookie': 'valreg=' + self.val_reg}

        res = self.testapp.post('/api/v1/auth/validate', headers=headers, params=params)

        assert res.json == {'first_coll_name': 'default-collection', 'registered': 'someuser'}

        assert self.testapp.cookies.get('__test_sesh', '') != ''
        #headers['Cookie'] += '; __test_sesh=' + self.testapp.cookies.get('__test_sesh')

        res = self.redis.hgetall('u:someuser:info')
        #res = self.appcont.manager._format_info(res)
        assert res['size'] == '0'
        assert res['max_size'] == '1000000000'
        assert res['created_at'] != None

    def test_api_val_reg_fail_already_registered(self):
        params = {'reg': self.val_reg}
        headers = {'Cookie': 'valreg=' + self.val_reg}

        res = self.testapp.post('/api/v1/auth/validate', headers=headers, params=params, status=400)
        assert res.json == {'error': 'already_registered'}

    def test_api_logout(self):
        res = self.testapp.post('/api/v1/auth/logout', status=200)
        assert res.json['success']

        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_api_register_fail_dupe_user(self):
        # dupe user
        params = {'email': 'test2@example.com',
                  'username': 'someuser',
                  'password': 'Password2',
                  'confirmpassword': 'Password2'
                 }

        res = self.testapp.post_json('/api/v1/auth/register', params=params, status=400)

        assert res.json == {'errors': {'validation': 'User <b>someuser</b> already exists! Please choose '
                                                     'a different username'}}

    def test_api_register_fail_dupe_email(self):
        # dupe email
        params = {'email': 'test@example.com',
                  'username': 'someuser2',
                  'password': 'Password2',
                  'confirmpassword': 'Password2'
                 }


        res = self.testapp.post_json('/api/v1/auth/register', params=params, status=400)

        assert res.json == {'errors': {'validation': 'There is already an account for '
                                                     '<b>test@example.com</b>. If you have trouble '
                                                     'logging in, you may <a href="/_forgot"><b>reset the '
                                                     'password</b></a>.'}}

    def test_api_val_reg_fail_already_registered_logged_out(self):
        params = {'reg': self.val_reg}
        headers = {'Cookie': 'valreg=' + self.val_reg}

        res = self.testapp.post('/api/v1/auth/validate', headers=headers, params=params, status=400)
        assert res.json == {'error': 'already_registered'}

    def test_login_fail_bad_password(self):
        params = {'username': 'someuser',
                  'password': 'Password2'}

        res = self.testapp.post_json('/api/v1/auth/login', params=params, status=401)

        assert res.json == {'error': 'invalid_login'}
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_login_fail_wrong_user(self):
        params = {'username': 'someuser2',
                  'password': 'Password2'}

        res = self.testapp.post_json('/api/v1/auth/login', params=params, status=401)

        assert res.json == {'error': 'invalid_login'}
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_login_fail_no_params(self):
        params = {'foo': 'bar'}

        res = self.testapp.post_json('/api/v1/auth/login', params=params, status=401)

        assert res.json == {'error': 'invalid_login'}
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_load_auth_not_logged_in(self):
        res = self.testapp.get('/api/v1/auth')

        assert res.json['role'] == None
        assert res.json['username'].startswith('temp-')
        assert res.json['anon'] == True
        assert res.json['coll_count'] == 0

    def test_login(self):
        params = {'username': 'someuser',
                  'password': 'Password1'}

        res = self.testapp.post_json('/api/v1/auth/login', params=params)

        assert res.json == {'role': 'archivist',
                            'username': 'someuser',
                            'coll_count': 1,
                            'anon': False}

        assert self.testapp.cookies.get('__test_sesh', '') != ''

    def test_login_already_logged_in(self):
        params = {'username': 'someuser',
                  'password': 'Password1'}

        res = self.testapp.post_json('/api/v1/auth/login', params=params, status=403)

        assert res.json == {'error': 'already_logged_in'}

    def test_load_auth_logged_in(self):
        res = self.testapp.get('/api/v1/auth')

        assert res.json == {'role': 'archivist',
                            'username': 'someuser',
                            'coll_count': 1,
                            'anon': False}

    def test_check_username_not_avail(self):
        res = self.testapp.get('/api/v1/auth/check_username/someuser')

        assert res.json == {'available': False}

    def test_update_password_fail(self):
        params = {'currPass': 'Password1',
                  'newPass': 'Password2',
                  'newPass2': 'Password3'
                 }

        res = self.testapp.post_json('/api/v1/auth/password/update', params=params, status=403)

        assert res.json['error'] == 'password_mismatch'

    def test_update_password(self):
        params = {'currPass': 'Password1',
                  'newPass': 'Password2',
                  'newPass2': 'Password2'
                 }

        res = self.testapp.post_json('/api/v1/auth/password/update', params=params)

        assert res.json == {'success': True}

    def test_logout_2(self):
        res = self.testapp.post('/api/v1/auth/logout', status=200)
        assert res.json['success']

        assert self.testapp.cookies.get('__test_sesh', '') == ''

    @classmethod
    def mock_send_reset_email(cls, sender, title, text):
        groups = re.search('(/_resetpassword/([^"]+))', text).groups()
        cls.reset_code = groups[1]

    def test_reset_invalid(self):
        # invalid username and email
        params = {'username': 'foo', 'email': 'bar'}
        res = self.testapp.post_json('/api/v1/auth/password/reset_request', params=params, status=404)

        assert res.json == {'error': 'no_such_user'}

    def test_reset_by_email(self):
        TestApiUserLogin.reset_code = None

        # reset by email
        params = {'email': 'test@example.com'}
        with patch('cork.Mailer.send_email', self.mock_send_reset_email):
            res = self.testapp.post_json('/api/v1/auth/password/reset_request', params=params)

        # valid reset
        assert TestApiUserLogin.reset_code != None

    def test_reset_by_username(self):
        TestApiUserLogin.reset_code = None

        # reset by username
        params = {'username': 'someuser', 'email': ''}
        with patch('cork.Mailer.send_email', self.mock_send_reset_email):
            res = self.testapp.post_json('/api/v1/auth/password/reset_request', params=params)

        # valid reset
        assert TestApiUserLogin.reset_code != None

    def test_reset_code_invalid(self):
        # invalid reset
        params = {'resetCode': 'abc',
                  'newPass': 'TestTest789',
                  'newPass2': 'TestTest789'
                 }

        res = self.testapp.post_json('/api/v1/auth/password/reset', params=params, status=403)
        assert res.json == {'error': 'invalid_reset_code'}

    def test_reset_code_valid_password_mismatch(self):
        # invalid reset
        params = {'resetCode': TestApiUserLogin.reset_code,
                  'newPass': 'TestTest789',
                  'newPass2': 'TestTest780'
                 }

        res = self.testapp.post_json('/api/v1/auth/password/reset', params=params, status=403)
        assert res.json == {'error': 'password_mismatch'}

    def test_reset_code_valid(self):
        # valid reset
        params = {'resetCode': TestApiUserLogin.reset_code,
                  'newPass': 'TestTest789',
                  'newPass2': 'TestTest789'
                 }

        assert self.testapp.cookies.get('__test_sesh', '') == ''

        res = self.testapp.post_json('/api/v1/auth/password/reset', params=params)
        assert res.json == {'success': True}

    def test_login_2(self):
        params = {'username': 'someuser',
                  'password': 'TestTest789'}

        res = self.testapp.post_json('/api/v1/auth/login', params=params)

        assert res.json['username'] == 'someuser'

        assert self.testapp.cookies.get('__test_sesh', '') != ''

    def test_reset_code_valid_already_logged_in(self):
        # valid reset
        params = {'resetCode': TestApiUserLogin.reset_code,
                  'newPass': 'TestTest789',
                  'newPass2': 'TestTest789'
                 }

        res = self.testapp.post_json('/api/v1/auth/password/reset', params=params, status=403)
        assert res.json == {'error': 'already_logged_in'}

    def test_api_user_info(self):
        res = self.testapp.get('/api/v1/user/someuser')

        user = res.json['user']

        assert user['created_at'] != ''
        assert user['email'] == 'test@example.com'
        assert user['last_login'] != ''
        assert user['name'] == ''
        assert user['role'] == 'archivist'
        assert user['username'] == 'someuser'
        assert user['space_utilization'] == {'available': 1000000000.0,
                                             'total': 1000000000.0,
                                             'used': 0.0}

        assert user['collections'][0]['title'] == 'Default Collection'
        assert user['collections'][0]['owner'] == 'someuser'
        assert user['collections'][0]['id'] == 'default-collection'
        assert 'This is your first collection' in user['collections'][0]['desc']
        assert user['collections'][0]['size'] == 0

        assert self.ISO_DT_RX.match(user['created_at'])
        assert self.ISO_DT_RX.match(user['updated_at'])
        assert self.ISO_DT_RX.match(user['last_login'])

    def test_update_user_desc(self):
        res = self.testapp.post('/api/v1/user/someuser/desc', params='New Description')

        assert res.json == {}

    def test_api_user_info_2(self):
        res = self.testapp.get('/api/v1/user/someuser?include_colls=false')

        user = res.json['user']

        assert user['username'] == 'someuser'
        assert user['desc'] == 'New Description'

        # collections not included
        assert 'collections' not in user

    def test_delete_no_such_user(self):
        res = self.testapp.delete('/api/v1/user/someuser2', status=404)

        assert res.json == {'error': 'no_such_user'}

    def test_delete_user(self):
        res = self.testapp.delete('/api/v1/user/someuser')

        assert res.json == {'deleted_user': 'someuser'}

    def test_load_auth_not_logged_in_2(self):
        res = self.testapp.get('/api/v1/auth')

        assert res.json['role'] == None
        assert res.json['username'].startswith('temp-')
        assert res.json['anon'] == True
        assert res.json['coll_count'] == 0

    def test_invalid_api(self):
        # unknown api
        assert self.testapp.options('/api/v1/no-such-api/foo', status=404).json == {'error': 'not_found'}
        assert self.testapp.post('/api/v1/no-such-api/foo', status=404).json == {'error': 'not_found'}

        assert self.testapp.get('/api/v1/no-such-api/foo', status=404).json == {'error': 'not_found'}
        assert self.testapp.get('/api/v1/no-such-api', status=404).json == {'error': 'not_found'}
        assert self.testapp.get('/api/v1', status=404).json == {'error': 'not_found'}
        assert self.testapp.get('/api/', status=404).json == {'error': 'not_found'}
        assert self.testapp.get('/api', status=404).json == {'error': 'not_found'}

        # unknown user
        assert self.testapp.options('/unk/v1/no-such-api/foo', status=404).json == {'error': 'no_such_user'}
        assert self.testapp.post('/unk/v1/no-such-api/foo', status=404).json == {'error': 'no_such_user'}

        assert self.testapp.get('/unk/v1/no-such-api/foo', status=404).json == {'error': 'no_such_user'}
        assert self.testapp.get('/unk/v1/no-such-api', status=404).json == {'error': 'no_such_user'}
        assert self.testapp.get('/unk/v1', status=404).json == {'error': 'no_such_user'}
        assert self.testapp.get('/unk/', status=404).json == {'error': 'no_such_user'}
        assert self.testapp.get('/unk', status=404).json == {'error': 'no_such_user'}

