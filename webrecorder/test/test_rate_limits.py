from .testutils import FullStackTests
import os
import time

from webrecorder.models.usermanager import CLIUserManager


# ============================================================================
class TestRateLimits(FullStackTests):
    BASE_LIMIT = 1200
    RESTRICT_LIMIT = 500

    @classmethod
    def setup_class(cls):
        os.environ['RATE_LIMIT_MAX'] = str(cls.BASE_LIMIT)
        os.environ['RATE_LIMIT_HOURS'] = '2'
        os.environ['RATE_LIMIT_RESTRICTED_HOURS'] = '2'
        os.environ['RATE_LIMIT_RESTRICTED_MAX'] = str(cls.RESTRICT_LIMIT)
        os.environ['RATE_LIMIT_RESTRICTED_IPS'] = '255.255.255,10.0.0'
        super(TestRateLimits, cls).setup_class()
        cls.user_manager = CLIUserManager()

    @classmethod
    def teardown_class(cls):
        super(TestRateLimits, cls).teardown_class()
        del os.environ['RATE_LIMIT_MAX']
        del os.environ['RATE_LIMIT_HOURS']
        del os.environ['RATE_LIMIT_RESTRICTED_HOURS']
        del os.environ['RATE_LIMIT_RESTRICTED_MAX']
        del os.environ['RATE_LIMIT_RESTRICTED_IPS']

    def test_record_1(self):
        self.set_uuids('Recording', ['rec'])
        headers = {'X-Real-IP': '127.0.0.1'}
        res = self.testapp.get('/_new/temp/rec/record/mp_/http://httpbin.org/get?food=bar', headers=headers)
        assert res.headers['Location'].endswith('/' + self.anon_user + '/temp/rec/record/mp_/http://httpbin.org/get?food=bar')
        res = res.follow(headers=headers)
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        time.sleep(0.0)
        keys = self.redis.keys('ipr:*')
        assert len(keys) == 1
        assert keys[0].startswith('ipr:127.0.0')
        assert int(self.redis.get(keys[0])) < self.BASE_LIMIT

    def test_record_again_until_rate_limited(self):
        headers = {'X-Real-IP': '127.0.0.1'}
        res = self.testapp.get('/{user}/temp/rec/record/mp_/http://httpbin.org/get?food=bar2'.format(user=self.anon_user), headers=headers)

        time.sleep(0.0)
        keys = self.redis.keys('ipr:127.0.0*')
        assert int(self.redis.get(keys[0])) >= self.BASE_LIMIT

        res = self.testapp.get('/{user}/temp/rec/record/mp_/http://httpbin.org/get?food=bar3'.format(user=self.anon_user),
                                                                                                     headers=headers,
                                                                                                     status=402)

    def test_record_restricted_rate_limit(self):
        headers = {'X-Real-IP': '10.0.0.5'}
        res = self.testapp.get('/{user}/temp/rec/record/mp_/http://httpbin.org/get?food=bar4'.format(user=self.anon_user), headers=headers)

        time.sleep(0.0)
        keys = self.redis.keys('ipr:10.0.0*')

        TestRateLimits.limit = int(self.redis.get(keys[0]))
        assert TestRateLimits.limit >= self.RESTRICT_LIMIT


        res = self.testapp.get('/{user}/temp/rec/record/mp_/http://httpbin.org/get?food=bar5'.format(user=self.anon_user),
                                                                                                     headers=headers,
                                                                                                     status=402)

        assert res.status_code == 402

    def test_create_rate_unlimited(self):
        self.user_manager.create_user('user2@example.com', 'test-unlim', 'TestTest456', 'rate-unlimited-archivist', 'Test User')

        params = {'username': 'test-unlim',
                  'password': 'TestTest456',
                 }

        res = self.testapp.post_json('/api/v1/auth/login', params=params)
        assert res.json['user']['username'] == 'test-unlim'
        assert self.testapp.cookies['__test_sesh'] != ''

    def test_record_not_limited(self):
        self.set_uuids('Recording', ['rec'])
        headers = {'X-Real-IP': '10.0.0.5'}
        res = self.testapp.get('/_new/temp/rec/record/mp_/http://httpbin.org/get?food=bar', headers=headers, status=302)
        res = res.follow(headers=headers)

        assert '"food": "bar"' in res.text, res.text

        time.sleep(0.0)
        keys = self.redis.keys('ipr:10.0.0*')

        assert int(self.redis.get(keys[0])) == TestRateLimits.limit

        res = self.testapp.post_json('/api/v1/auth/logout', status=200)
        assert res.json['success']

    def test_create_rate_limited(self):
        self.user_manager.create_user('user@example.com', 'test-lim', 'TestTest456', 'archivist', 'Test User')

        params = {'username': 'test-lim',
                  'password': 'TestTest456',
                 }

        res = self.testapp.post_json('/api/v1/auth/login', params=params)
        assert res.json['user']['username'] == 'test-lim'
        assert self.testapp.cookies['__test_sesh'] != ''

    def test_record_logged_in_limited(self):
        self.set_uuids('Recording', ['rec'])
        headers = {'X-Real-IP': '10.0.0.5'}

        res = self.testapp.get('/_new/temp/rec/record/mp_/http://httpbin.org/get?food=bar5',
                               headers=headers, status=302)

        res = res.follow(headers=headers, status=402)

        assert 'Rate Limit Exceeded' in res.text
        assert 'network traffic quota' in res.text

        time.sleep(0.0)
        keys = self.redis.keys('ipr:10.0.0*')

        assert int(self.redis.get(keys[0])) == TestRateLimits.limit

        res = self.testapp.post_json('/api/v1/auth/logout', status=200)
        assert res.json['success']
