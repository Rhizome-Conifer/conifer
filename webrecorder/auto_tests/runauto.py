import requests
import pytest
import subprocess


# ============================================================================
class TestAuto(object):
    PREFIX = 'http://localhost:8089'
    USER = 'testauto'
    LIST_ID = ''
    AUTO_ID = ''
    NUM_BROWSERS = 2

    @classmethod
    def setup_class(cls):
        cls.session = requests.session()

    @classmethod
    def teardown_class(cls):
        pass

    def get(self, url, **kwargs):
        full_url = self.PREFIX + url
        return self.session.get(full_url, **kwargs)

    def post(self, url, **kwargs):
        full_url = self.PREFIX + url
        return self.session.post(full_url, **kwargs)

    @classmethod
    def delete(self, url, **kwargs):
        full_url = self.PREFIX + url
        return self.session.delete(full_url, **kwargs)

    @pytest.mark.always
    def test_create_user(self):
        res = subprocess.run(['docker', 'exec', 'webrecorder_app_1', "python", "-m", "webrecorder.admin",
                              "-c", "testauto@example.com", "testauto", "TestTest123", "archivist", "Auto Test"],
                             stdout=subprocess.PIPE)

        assert b'Created user testauto' in res.stdout or b'A user already exists' in res.stdout
        assert res.returncode == 0

    @pytest.mark.always
    def test_login(self):
        params = {'username': self.USER,
                  'password': 'TestTest123',
                 }

        res = self.post('/api/v1/auth/login', json=params)
        assert res.json()['user']['username'] == self.USER

    def test_create_coll(self):
        res = self.post('/api/v1/collections?user=testauto',
                        json={'title': 'Auto Test'})

        assert res.json()['collection']['id'] == 'auto-test'
        assert res.json()['collection']['title'] == 'Auto Test'

    def test_create_auto(self):
        params = {'scope_type': 'single-page',
                  'num_browsers': self.NUM_BROWSERS,
                 }

        res = self.post('/api/v1/auto?user=testauto&coll=auto-test', json=params)

        assert res.json()['auto']
        TestAuto.AUTO_ID = res.json()['auto']

    def test_add_urls(self):
        params = {'urls': [
            'https://twitter.com/webrecorder_io',
            'https://rhizome.org/'
            ]}

        res = self.post('/api/v1/auto/{0}/queue_urls?user=testauto&coll=auto-test'.format(self.AUTO_ID), json=params)

        assert res.json()['success']

    def test_start(self):
        res = self.post('/api/v1/auto/{0}/start?user=testauto&coll=auto-test'.format(self.AUTO_ID))

        print(res.json())

        assert res.json()['success']

    @pytest.mark.append
    def _test_append_only(self, append, auto_id):
        params = {'title': 'Add Url'}

        res = self.post('/api/v1/lists?user=testauto&coll=auto-test', json=params)

        list_id = res.json()['list']['id']

        bookmarks = [{'url': append, 'title': append}]
        res = self.post('/api/v1/list/%s/bulk_bookmarks?user=testauto&coll=auto-test' % list_id,
                        json=bookmarks)

        assert res.json()['list']

        params = {'list': list_id}
        res = self.post('/api/v1/auto/{0}/queue_list?user=testauto&coll=auto-test'.format(auto_id), json=params)

        assert res.json()['status']

    def test_get_auto(self):
        res = self.get('/api/v1/auto/{0}?user=testauto&coll=auto-test'.format(self.AUTO_ID))

        auto = res.json()['auto']
        assert auto['queue'] is not None
        assert auto['seen'] is not None
        assert auto['pending'] is not None
        assert len(auto['browsers']) == self.NUM_BROWSERS

        assert auto['scope_type'] == 'single-page'

    @pytest.mark.delete
    def _test_delete_auto(self):
        res = self.delete('/api/v1/auto/{0}?user=testauto&coll=auto-test'.format(self.AUTO_ID))

        assert res.json() == {'deleted_id': str(self.AUTO_ID)}

    @pytest.mark.delete
    def test_delete_coll(self):
        res = self.delete('/api/v1/collection/auto-test?user=testauto')

        assert res.json() == {'deleted_id': 'auto-test'} or res.json() == {'error': 'no_such_collection'}


