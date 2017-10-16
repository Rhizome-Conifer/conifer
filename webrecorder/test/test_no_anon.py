import os
from .testutils import BaseWRTests
import pytest


# ============================================================================
@pytest.fixture(params=['/record/http://example.com/',
                        '/_new/foo/rec-sesh/record/http://example.com/',
                        '/_new/foo/rec-sesh/record/mp_/http://example.com/',
                        '/_new/temp/rec-sesh/extract/mp_/http://example.com/'])
def url(request):
    return request.param


# ============================================================================
class TestNoAnon(BaseWRTests):
    @classmethod
    def setup_class(cls):
        os.environ['ANON_DISABLED'] = '1'
        super(TestNoAnon, cls).setup_class()

    @classmethod
    def teardown_class(cls):
        super(TestNoAnon, cls).teardown_class()
        os.environ['ANON_DISABLED'] = '0'

    def test_anon_rec_disabled(self, url):
        res = self.testapp.get(url)
        assert res.status_code == 302
        assert res.headers['Location'] == 'http://localhost:80/'

        res = res.follow()
        assert 'anonymous recording is not available' in res.text
        assert '<input>' not in res.text
