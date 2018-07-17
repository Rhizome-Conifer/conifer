from .testutils import FullStackTests

import os


# ============================================================================
class TestExternalColl(FullStackTests):
    @classmethod
    def setup_class(cls):
        os.environ['ALLOW_EXTERNAL'] = '1'
        super(TestExternalColl, cls).setup_class()

    @classmethod
    def teardown_class(cls):
        super(TestExternalColl, cls).teardown_class()
        os.environ.pop('ALLOW_EXTERNAL', '')

    def test_external_init(self):
        params = {'external': True,
                  'title': 'external'
                 }

        res = self.testapp.post_json('/api/v1/collections?user={user}'.format(user=self.anon_user), params=params)

        assert res.json['collection']['slug'] == 'external'

    def test_external_set_cdx(self):
        cdx = """\
com,example)/ 20180306181354 http://example.com/ text/html 200 A6DESOVDZ3WLYF57CS5E4RIC4ARPWRK7 - - 1214 773 test.warc.gz
com,example)/fake 20180306181354 http://example.com/fake text/html 200 A6DESOVDZ3WLYF57CS5E4RIC4ARPWRK7 - - 1214 773 test.warc.gz
"""
        res = self.testapp.put('/api/v1/collection/external/cdx?user={user}'.format(user=self.anon_user), params=cdx)

        assert res.json['success'] == 2

    def test_external_set_warc(self):
        warc_path = 'file://' + os.path.join(self.get_curr_dir(), 'warcs', 'test_3_15_upload.warc.gz')

        res = self.testapp.put_json('/api/v1/collection/external/warc?user={user}'.format(user=self.anon_user),
                                    params={'warcs': {'test.warc.gz': warc_path}})

        assert res.json['success'] == 1

    def test_replay(self):
        res = self.testapp.get('/{user}/external/mp_/http://example.com/'.format(user=self.anon_user))

        assert 'Example Domain' in res.text

