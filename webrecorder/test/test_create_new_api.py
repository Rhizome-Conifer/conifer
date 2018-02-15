from .testutils import FullStackTests


# ============================================================================
class TestCreateNewApi(FullStackTests):
    def test_api_new(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'record'
                 }

        res = self.testapp.post_json('/api/v1/new', params=params)
        assert res.json['url'].endswith('/record/http://httpbin.org/get?food=bar')

    def test_api_new_content(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'record',
                  'is_content': True,
                 }

        res = self.testapp.post_json('/api/v1/new', params=params)
        assert res.json['url'].endswith('/record/mp_/http://httpbin.org/get?food=bar')

        res = self.testapp.get(res.json['url'], status=200)
        assert '"food": "bar"' in res.text, res.text

    def test_api_new_extract_browser(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'extract:ab',
                  'ts': '19960201',
                  'browser': 'chrome:53',
                  'is_content': True,
                 }

        res = self.testapp.post_json('/api/v1/new', params=params)
        assert res.json['url'].endswith('/extract:ab/19960201$br:chrome:53/http://httpbin.org/get?food=bar')

    def test_api_new_patch_ts(self):
        params = {'coll': 'temp',
                  'url':  'http://httpbin.org/get?food=bar',
                  'mode': 'patch',
                  'ts': '2001',
                 }

        res = self.testapp.post_json('/api/v1/new', params=params)
        assert res.json['url'].endswith('/patch/2001/http://httpbin.org/get?food=bar')

    def test_api_temp_user_recs_created(self):
        res = self.testapp.get('/api/v1/temp-users/' + self.anon_user)
        assert res.json['rec_count'] == 5



