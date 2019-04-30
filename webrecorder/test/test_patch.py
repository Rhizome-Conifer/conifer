from .testutils import FullStackTests
import os
from webrecorder.models.stats import Stats
from webrecorder.utils import today_str



# ============================================================================
class TestPatchContent(FullStackTests):
    def test_patch_top_frame(self):
        self.set_uuids('Recording', ['new-patch'])
        res = self.testapp.get('/_new/temp/new-patch/patch/http://httpbin.org/get?food=bar')
        res.headers['Location'].endswith('/' + self.anon_user + '/temp/new-patch/patch/http://httpbin.org/get?food=bar')
        res = res.follow()
        res.charset = 'utf-8'

        assert res.status_code == 200
        assert '"patch"' in res.text

    def test_patch_content(self):
        res = self.testapp.get('/{user}/temp/new-patch/patch/mp_/http://httpbin.org/get?food=bar'.format(user=self.anon_user))
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'ts': '2016010203000000'}
        res = self.testapp.post_json('/api/v1/recording/new-patch/pages?user={user}&coll=temp'.format(user=self.anon_user), params=page)

        assert res.json['page_id']

        user = self.anon_user

        coll, rec = self.get_coll_rec(self.anon_user, 'temp', 'new-patch')

        self.assert_coll_rec_warcs(coll, rec, 1, 1)

        anon_dir = os.path.join(self.warcs_dir, user)
        assert len(os.listdir(anon_dir)) == 1

    def test_patch_js(self):
        res = self.testapp.get('/{user}/temp/new-patch/patch/js_/https://httpbin.org/base64/ZnVuY3Rpb24gdGVzdCgpIHsNCiAgdGVzdCgiYWJjIik7DQp9'.format(user=self.anon_user))
        assert 'let window' in res.text

    def test_patch_content_at_timestamp(self):
        self.set_uuids('Recording', ['new-patch-2'])
        res = self.testapp.get('/_new/temp/new-patch-2/patch/2000mp_/http://example.com/')
        assert res.headers['Location'].endswith('/' + self.anon_user + '/temp/new-patch-2/patch/2000mp_/http://example.com/')
        res = res.follow()
        res.charset = 'utf-8'

        assert 'Reserved Domain Names' in res.text, res.text

        coll, rec = self.get_coll_rec(self.anon_user, 'temp', 'new-patch-2')
        assert self.redis.smembers('r:{rec}:ra'.format(rec=rec)) == {'ia'}

        assert self.testapp.cookies['__test_sesh'] != ''

    def test_stats(self):
        assert self.redis.exists(Stats.SOURCES_KEY.format('ia'))
        assert int(self.redis.hget(Stats.SOURCES_KEY.format('ia'), today_str())) > 0

        assert int(self.redis.hget(Stats.PATCH_TEMP_KEY, today_str())) > 0

