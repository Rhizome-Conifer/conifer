from .testfullstack import FullStackTests

from mock import patch

import re


# ============================================================================
class TestRegisterMigrate(FullStackTests):
    @classmethod
    def setup_class(cls):
        super(TestRegisterMigrate, cls).setup_class(extra_config_file='test_no_invites_config.yaml')

    def test_get_anon_user(self):
        res = self.testapp.get('/api/v1/anon_user')
        TestRegisterMigrate.anon_user = res.json['anon_user']
        assert self.anon_user != ''

    def test_anon_record_1(self):
        res = self.testapp.get('/' + self.anon_user + '/temp/abc/record/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'ts': '2016010203000000'}
        res = self.testapp.post('/api/v1/recordings/abc/pages?user={user}&coll=temp'.format(user=self.anon_user), params=page)

        assert res.json == {}

        user = self.anon_user

        warc_key = 'c:{user}:{coll}:warc'.format(user=user, coll='temp')
        assert self.redis.hlen(warc_key) == 1

    def test_register(self):
        res = self.testapp.get('/_register')
        res.charset = 'utf-8'

        assert self.testapp.cookies['__test_sesh'] != ''

        assert '"to-coll"' in res.text

    def mock_send_reg_email(self, sender, title, text):
        global val_reg_url
        val_reg_url = re.search('(/_valreg/[^"]+)', text).group(1)

    def test_register_post_success(self):
        params = {'email': 'test@example.com',
                  'username': 'someuser',
                  'password': 'Password1',
                  'confirmpassword': 'Password1',

                  'to-coll': 'Test Migrate',
                  'move-temp': '1',
                 }

        with patch('cork.Mailer.send_email', self.mock_send_reg_email):
            res = self.testapp.post('/_register', params=params)

        assert res.headers['Location'] == 'http://localhost:80/'

    def test_val_user_reg(self):
        res = self.testapp.get(val_reg_url)
        assert res.headers['Location'] == 'http://localhost:80/someuser'

        user_info = self.redis.hgetall('u:someuser')
        user_info = self.appcont.manager._format_info(user_info)
        assert user_info['max_size'] == '1000000000'
        assert user_info['max_coll'] == '10'
        assert user_info['created_at'] != None

        assert self.redis.exists('c:someuser:test-migrate:info')
        coll_info = self.redis.hgetall('c:someuser:test-migrate:info')
        coll_info = self.appcont.manager._format_info(coll_info)

        print(coll_info)

        assert coll_info['id'] == 'test-migrate'
        assert coll_info['title'] == 'Test Migrate'
        assert coll_info['created_at'] != None

        assert user_info['size'] == coll_info['size']

    def test_coll_list(self):
        res = self.testapp.get('/someuser')
        assert '"/someuser/test-migrate"' in res.text
        assert 'Test Migrate' in res.text





