from .testutils import FullStackTests


# ============================================================================
class TestExtractContent(FullStackTests):
    def test_anon_extract_1(self):
        res = self.testapp.get('/{user}/temp/Extract Test/extract:ia/1996/http://geocities.com/'.format(user=self.anon_user))
        assert res.status_code == 302
        assert res.location.endswith('/temp/extract-test/extract:ia/1996/http://geocities.com/')

        res = self.testapp.get('/{user}/temp/extract-test/extract:ia/1996mp_/http://geocities.com/'.format(user=self.anon_user))
        assert b'GeoCities' in res.body
        assert b'wbinfo.timestamp = "19961226' in res.body

    def test_anon_extract_2(self):
        res = self.testapp.get('/_new/temp/Extract Test/record/http://web.archive.org/web/1996/geocities.com/')
        assert res.status_code == 302
        assert res.location.endswith('/temp/extract-test-2/extract:ia/1996/http://geocities.com/')

        res = self.testapp.get('/{user}/temp/extract-test-2/extract:ia/1996mp_/http://geocities.com/'.format(user=self.anon_user))

        assert b'GeoCities' in res.body
        assert b'wbinfo.timestamp = "19961226' in res.body

        assert self.testapp.cookies['__test_sesh'] != ''

    def test_anon_extract_redirect(self):
        res = self.testapp.get('/{user}/temp/extract-test/record/http://web.archive.org/web/1996/geocities.com/'.format(user=self.anon_user))
        assert res.status_code == 302
        assert res.location.endswith('/temp/extract-test/extract:ia/1996/http://geocities.com/')

    def test_anon_extract_only(self):
        res = self.testapp.get('/{user}/temp/Extract Only Test/extract_only:ia/1996mp_/http://geocities.com/'.format(user=self.anon_user))
        assert res.status_code == 302
        res = res.follow()

        assert b'GeoCities' in res.body
        assert b'wbinfo.timestamp = "19961226' in res.body

        assert self.testapp.cookies['__test_sesh'] != ''

    def test_anon_extract_replay(self):
        res = self.testapp.get('/{user}/temp/1996mp_/http://geocities.com/'.format(user=self.anon_user))

        assert b'GeoCities' in res.body
        assert b'wbinfo.timestamp = "19961226' in res.body

        assert self.testapp.cookies['__test_sesh'] != ''

    def test_coll_info(self):
        res = self.testapp.get('/api/v1/collections/temp?user={user}'.format(user=self.anon_user))
        recs = res.json['collection']['recordings']
        assert len(recs) == 5

        recs = {obj['id']: obj for obj in recs}

        # Extract Test
        assert recs['extract-test']['title'] == 'Extract Test'
        assert recs['extract-test']['ra_sources'] == ['ia']

        # empty patch
        assert recs['patch-of-extract-test']['size'] == 0
        assert recs['patch-of-extract-test']['title'] == 'Patch of Extract Test'
        assert recs['patch-of-extract-test']['rec_type'] == 'patch'

        # Extract Test 2
        assert recs['extract-test-2']['title'] == 'Extract Test 2'
        assert recs['extract-test-2']['ra_sources'] == ['ia']

        # empty patch
        assert recs['patch-of-extract-test-2']['size'] == 0
        assert recs['patch-of-extract-test-2']['title'] == 'Patch of Extract Test 2'
        assert recs['patch-of-extract-test-2']['rec_type'] == 'patch'

        # Extract Only Test
        assert recs['extract-only-test']['title'] == 'Extract Only Test'
        assert recs['extract-only-test']['ra_sources'] == ['ia']
