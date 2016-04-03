from fakeredis import FakeStrictRedis

from webagg.test.testutils import TempDirTests, LiveServerTests, BaseTestClass, to_path
from webagg.test.testutils import FakeRedisTests
import os
import webtest

from six.moves.urllib.parse import quote, urlsplit

#from ..webrecrecorder import WebRecRecorder
from wrrecorder import get_shared_config_root

general_req_data = "\
GET {path} HTTP/1.1\r\n\
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8\r\n\
User-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.116 Safari/537.36\r\n\
Host: {host}\r\n\
\r\n"



# ============================================================================
class TestWebRecRecorder(LiveServerTests, FakeRedisTests, TempDirTests, BaseTestClass):
    @classmethod
    def setup_class(cls):
        super(TestWebRecRecorder, cls).setup_class()

        cls.warcs_dir = to_path(cls.root_dir + '/warcs')

        os.makedirs(cls.warcs_dir)

        cls.upstream_url = 'http://localhost:{0}'.format(cls.server.port)

        os.environ['REDIS_BASE_URL'] = 'redis://localhost/2'

        os.environ['WEBAGG_HOST'] = cls.upstream_url
        os.environ['RECORD_ROOT'] = cls.warcs_dir

        os.environ['WR_CONFIG'] = os.path.join(get_shared_config_root(), 'wr.yaml')

        from wrrecorder.main import application, wr
        cls.wr_rec = wr
        #cls.wr_rec = WebRecRecorder()
        #cls.testapp = webtest.TestApp(cls.wr_rec.app)

        cls.testapp = webtest.TestApp(application)
        cls.redis = FakeStrictRedis.from_url(os.environ['REDIS_BASE_URL'])

    def _test_warc_write(self, url, user, coll, rec):
        parts = urlsplit(url)
        host = parts.netloc
        path = parts.path
        if parts.query:
            path += '?' + parts.query

        req_url = '/record/live/resource/postreq?url={url}&param.recorder.user={user}&param.recorder.coll={coll}&param.recorder.rec={rec}'
        req_url = req_url.format(url=quote(url), user=user, coll=coll, rec=rec)
        resp = self.testapp.post(req_url, general_req_data.format(host=host, path=path).encode('utf-8'))

        if not self.wr_rec.recorder.write_queue.empty():
            self.wr_rec.recorder._write_one()

        assert resp.headers['WebAgg-Source-Coll'] == 'live'

        return resp

    def test_multi_user_rec(self):
        resp = self._test_warc_write('http://httpbin.org/get?foo=bar', user='USER', coll='COLL', rec='REC')

        keys = self.redis.keys()
        keys = [k.decode('utf-8') for k in keys]

        assert set(keys) == set([
            'c:USER:COLL:warc',
            'r:USER:COLL:REC:cdxj',
            'r:USER:COLL:REC:info',
            'c:USER:COLL:info',
            'u:USER'
        ])

        resp.charset = 'utf-8'
        assert '"foo": "bar"' in resp.text

        size = self.redis.hget('r:USER:COLL:REC:info', 'size')
        assert size is not None
        assert size == self.redis.hget('c:USER:COLL:info', 'size')
        assert size == self.redis.hget('u:USER', 'size')

        assert self.redis.hget('r:USER:COLL:REC:info', 'updated_at') is not None


    def test_multi_user_rec_2(self):
        resp = self._test_warc_write('http://httpbin.org/get?boo=far', user='USER', coll='COLL', rec='REC2')

        keys = self.redis.keys()
        keys = [k.decode('utf-8') for k in keys]

        assert set(keys) == set([
            'c:USER:COLL:warc',
            'r:USER:COLL:REC:cdxj',
            'r:USER:COLL:REC2:cdxj',
            'r:USER:COLL:REC:info',
            'r:USER:COLL:REC2:info',
            'c:USER:COLL:info',
            'u:USER'
        ])

        resp.charset = 'utf-8'
        assert '"boo": "far"' in resp.text

