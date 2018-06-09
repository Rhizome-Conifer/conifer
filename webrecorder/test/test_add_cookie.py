from .testutils import FullStackTests

import os
import gevent


# ============================================================================
class TestAddCookie(FullStackTests):
    def test_record_1(self):
        self.set_uuids('Recording', ['rec-a'])

        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'is_content': True,
                  'mode': 'record'
                 }

        res = self.testapp.post_json('/api/v1/new', params=params)

        assert res.json['url']

        res = self.testapp.get(res.json['url'], status=200)

        assert '"food": "bar"' in res.text
        assert self.testapp.cookies['__test_sesh'] != ''

    def test_record_add_cookie_1(self):
        res = self.testapp.get('/{user}/temp/rec-a/record/mp_/http://test.httpbin.org/cookies'.format(user=self.anon_user))

        # no cookies
        assert res.json['cookies'] == {}


        params = {'url': 'http://httpbin.org/get?food=bar',
                  'path': '/',
                  'rec': 'rec-a',
                  'domain': '.httpbin.org',
                  'name': 'extra',
                  'value': 'cookie!'
                 }

        assert self.testapp.cookies['__test_sesh'] != ''

        res = self.testapp.post_json('/api/v1/auth/cookie?user={user}&coll=temp'.format(user=self.anon_user), params=params)

        assert res.json == {'success': '.httpbin.org'}

        res = self.testapp.get('/{user}/temp/rec-a/record/mp_/http://test.httpbin.org/cookies'.format(user=self.anon_user))

        # cookies passed to server
        assert res.json['cookies']['extra'] == 'cookie!'
