from .testutils import FullStackTests

from urllib.parse import parse_qsl

import os


# ============================================================================
class TestExternalColl(FullStackTests):
    runner_env_params = {'TEMP_SLEEP_CHECK': '1',
                         'APP_HOST': 'app-host',
                         'CONTENT_HOST': 'content-host'}
    anon_user = None


    @classmethod
    def setup_class(cls):
        os.environ['ALLOW_EXTERNAL'] = '1'
        os.environ['CONTENT_ERROR_REDIRECT'] = 'http://external.example.com/error'
        os.environ['CONTENT_HOST'] = 'content-host'
        os.environ['APP_HOST'] = 'app-host'
        super(TestExternalColl, cls).setup_class(init_anon=False)

    @classmethod
    def teardown_class(cls):
        super(TestExternalColl, cls).teardown_class()
        os.environ.pop('ALLOW_EXTERNAL', '')
        os.environ.pop('CONTENT_ERROR_REDIRECT', '')
        os.environ.pop('CONTENT_HOST', '')
        os.environ.pop('APP_HOST', '')

    def test_external_init(self):
        params = {'external': True,
                  'title': 'external'
                 }

        res = self.testapp.post('/api/v1/auth/anon_user', headers={'Host': 'app-host'})
        TestExternalColl.anon_user = res.json['user']['username']

        self.assert_temp_user_sesh(TestExternalColl.anon_user)

        res = self.testapp.post_json('/api/v1/collections?user={user}'.format(user=self.anon_user),
                                     headers={'Host': 'app-host'},
                                     params=params)

        assert res.json['collection']['slug'] == 'external'

    def test_external_set_cdx(self):
        cdx = """\
com,example)/ 20180306181354 http://example.com/ text/html 200 A6DESOVDZ3WLYF57CS5E4RIC4ARPWRK7 - - 1214 773 test.warc.gz
com,example)/fake 20180306181354 http://example.com/fake text/html 200 A6DESOVDZ3WLYF57CS5E4RIC4ARPWRK7 - - 1214 773 test.warc.gz
"""
        res = self.testapp.put('/api/v1/collection/external/cdx?user={user}'.format(user=self.anon_user),
                               params=cdx,
                               headers={'Host': 'app-host'})

        assert res.json['success'] == 2

    def test_external_set_warc(self):
        warc_path = 'file://' + os.path.join(self.get_curr_dir(), 'warcs', 'test_3_15_upload.warc.gz')

        res = self.testapp.put_json('/api/v1/collection/external/warc?user={user}'.format(user=self.anon_user),
                                    params={'warcs': {'test.warc.gz': warc_path}},
                                    headers={'Host': 'app-host'})

        assert res.json['success'] == 1

    def test_replay(self):
        res = self.testapp.get('/{user}/external/mp_/http://example.com/'.format(user=self.anon_user),
                               headers={'Host': 'content-host'})

        res = res.follow(headers={'Host': 'app-host'})
        res = res.follow(headers={'Host': 'content-host'})
        res = res.follow(headers={'Host': 'content-host'})

        assert 'Example Domain' in res.text

    def test_error_redirect_content_not_found(self):
        res = self.testapp.get('/{user}/external/mp_/http://example.com/not_found'.format(user=self.anon_user),
                               status=307,
                               headers={'Host': 'content-host'})

        assert res.headers['Location'].startswith('http://external.example.com/error?')
        args = dict(parse_qsl(res.headers['Location'].split('?', 1)[1]))
        assert args == {'url': 'http://example.com/not_found',
                        'user': self.anon_user,
                        'type': 'replay-coll',
                        'status': '404',
                        'coll': 'external',
                        'rec': '*',
                        'error': '{"message": "No Resource Found"}',
                        'app_host': 'app-host',
                       }

    def test_error_redirect_other(self):
        res = self.testapp.get('/{user}/external2/mp_/http://example.com/not_found'.format(user=self.anon_user),
                               status=303,
                               headers={'Host': 'content-host'})

        assert res.headers['Location'].startswith('http://external.example.com/error?')
        args = dict(parse_qsl(res.headers['Location'].split('?', 1)[1]))
        assert args == {
                        'status': '404',
                        'error': 'no_such_collection',
                       }



