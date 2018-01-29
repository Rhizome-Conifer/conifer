from .testutils import FullStackTests


class TestNoCookies(FullStackTests):
    def setup_class(cls):
        super(TestNoCookies, cls).setup_class(init_anon=False)

    def test_home_page(self):
        res = self.testapp.get('/')
        assert 'Webrecorder' in res.text, res.text
        assert self.testapp.cookies == {}

    #Due to cookie handling, this does set a cookie for now
    #def test_live(self):
    #    res = self.testapp.get('/live/mp_/http://httpbin.org/get?food=bar')
    #    res.charset = 'utf-8'

    #    assert self.testapp.cookies == {}

    #    assert '"food": "bar"' in res.text, res.text


