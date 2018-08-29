from .testutils import FullStackTests
from webrecorder.models.stats import Stats
from webrecorder.utils import today_str


# ============================================================================
class TestExtractContent(FullStackTests):
    def test_anon_extract_top_frame_1(self):
        self.set_uuids('Recording', ['extract-test', 'patch-of-extract-test'])
        res = self.testapp.get('/_new/temp/Extract Test/extract:ia/1996/http://geocities.com/'.format(user=self.anon_user))
        assert res.status_code == 302
        assert res.location.endswith('/temp/extract-test/extract:ia/1996/http://geocities.com/')

        res = res.follow()
        assert '"extract"' in res.text

    def test_anon_extract_1(self):
        res = self.testapp.get('/{user}/temp/extract-test/extract:ia/1996mp_/http://geocities.com/'.format(user=self.anon_user))
        assert b'GeoCities' in res.body
        assert b'wbinfo.timestamp = "19961226' in res.body

    def test_anon_extract_top_frame_2(self):
        self.set_uuids('Recording', ['extract-test-2', 'patch-of-extract-test-2'])
        res = self.testapp.get('/_new/temp/Extract Test/record/http://web.archive.org/web/1996/geocities.com/')
        assert res.status_code == 302
        assert res.location.endswith('/temp/extract-test-2/extract:ia/1996/http://geocities.com/')

    def test_anon_extract_2(self):
        res = self.testapp.get('/{user}/temp/extract-test-2/extract:ia/1996mp_/http://geocities.com/'.format(user=self.anon_user))

        assert b'GeoCities' in res.body
        assert b'wbinfo.timestamp = "19961226' in res.body

        assert self.testapp.cookies['__test_sesh'] != ''

    def test_anon_extract_redirect(self):
        res = self.testapp.get('/{user}/temp/extract-test/record/http://web.archive.org/web/1996/geocities.com/'.format(user=self.anon_user))
        assert res.status_code == 302
        assert res.location.endswith('/temp/extract-test/extract:ia/1996/http://geocities.com/')

    def test_anon_extract_only(self):
        self.set_uuids('Recording', ['extract-only-test'])
        res = self.testapp.get('/_new/temp/Extract Only Test/extract_only:ia/1996mp_/http://geocities.com/'.format(user=self.anon_user))
        assert res.status_code == 302
        res = res.follow()

        assert b'GeoCities' in res.body
        assert b'wbinfo.timestamp = "19961226' in res.body

        assert self.testapp.cookies['__test_sesh'] != ''

    def test_anon_extract_only_no_rec(self):
        res = self.testapp.get('/{user}/temp/Extract Only No Rec/extract_only:ia/1996mp_/http://geocities.com/'.format(user=self.anon_user))
        assert res.status_code == 302
        res = res.follow(status=404)

        assert res.status_code == 404

    def test_anon_extract_replay(self):
        res = self.testapp.get('/{user}/temp/1996mp_/http://geocities.com/'.format(user=self.anon_user))

        assert b'GeoCities' in res.body
        assert b'wbinfo.timestamp = "19961226' in res.body

        assert self.testapp.cookies['__test_sesh'] != ''

    def test_coll_info(self):
        res = self.testapp.get('/api/v1/collection/temp?user={user}'.format(user=self.anon_user))
        recs = res.json['collection']['recordings']
        assert len(recs) == 5

        recs = {obj['id']: obj for obj in recs}

        # Extract Test
        assert recs['extract-test']['title'] == 'Extract Test'
        assert recs['extract-test']['ra_sources'] == ['ia']
        assert recs['extract-test']['duration'] >= 0
        assert recs['extract-test']['patch_rec'] == 'patch-of-extract-test'

        # empty patch
        assert recs['patch-of-extract-test']['size'] == 0
        assert recs['patch-of-extract-test']['title'] == 'Patch of Extract Test'
        assert recs['patch-of-extract-test']['rec_type'] == 'patch'
        assert recs['patch-of-extract-test']['duration'] >= 0

        # Extract Test 2
        assert recs['extract-test-2']['title'] == 'Extract Test'
        assert recs['extract-test-2']['ra_sources'] == ['ia']
        assert recs['extract-test-2']['duration'] >= 0
        assert recs['extract-test-2']['patch_rec'] == 'patch-of-extract-test-2'

        # empty patch
        assert recs['patch-of-extract-test-2']['size'] == 0
        assert recs['patch-of-extract-test-2']['title'] == 'Patch of Extract Test'
        assert recs['patch-of-extract-test-2']['rec_type'] == 'patch'
        assert recs['patch-of-extract-test-2']['duration'] >= 0

        # Extract Only Test
        assert recs['extract-only-test']['title'] == 'Extract Only Test'
        assert recs['extract-only-test']['ra_sources'] == ['ia']
        assert recs['extract-only-test']['duration'] >= 0
        assert 'patch_rec' not in recs['extract-only-test']

        # at least 1 second has expired
        assert res.json['collection']['timespan'] >= 0
        assert res.json['collection']['duration'] >= 0

    def test_stats(self):
        assert self.redis.exists(Stats.SOURCES_KEY.format('ia'))
        assert int(self.redis.hget(Stats.SOURCES_KEY.format('ia'), today_str())) > 0

        assert not self.redis.exists(Stats.PATCH_TEMP_KEY)


