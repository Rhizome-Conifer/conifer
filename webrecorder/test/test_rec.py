from fakeredis import FakeStrictRedis

#from .testutils import BaseWRTests
from .testutils import FullStackTests

from pywb.webagg.test.testutils import LiveServerTests

import os

import webtest

from six.moves.urllib.parse import quote, urlsplit
import time

general_req_data = "\
GET {path} HTTP/1.1\r\n\
Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8\r\n\
User-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.116 Safari/537.36\r\n\
Host: {host}\r\n\
\r\n"



# ============================================================================
class TestWebRecRecorder(FullStackTests):
    @classmethod
    def setup_class(cls):
        super(TestWebRecRecorder, cls).setup_class(rec=False, no_app=True)

        from webrecorder.rec.main import init

        app = init()
        cls.wr_rec = app.wr
        cls.testapp = webtest.TestApp(app)

    def _test_warc_write(self, url, user, coll, rec):
        parts = urlsplit(url)
        host = parts.netloc
        path = parts.path
        if parts.query:
            path += '?' + parts.query

        # Rec key must exist
        self.redis.hset('r:{user}:{coll}:{rec}:info'.format(user=user, coll=coll, rec=rec), 'id', rec)

        req_url = '/record/live/resource/postreq?url={url}&param.recorder.user={user}&param.recorder.coll={coll}&param.recorder.rec={rec}'
        req_url = req_url.format(url=quote(url), user=user, coll=coll, rec=rec)
        resp = self.testapp.post(req_url, general_req_data.format(host=host, path=path).encode('utf-8'))

        while not self.wr_rec.recorder.write_queue.empty():
            self.wr_rec.recorder._write_one()

        assert resp.headers['WebAgg-Source-Coll'] == 'live'

        return resp

    def test_multi_user_rec(self):
        resp = self._test_warc_write('http://httpbin.org/get?foo=bar', user='USER', coll='COLL', rec='REC')

        keys = self.redis.keys()

        assert set(keys) == set([
            'r:USER:COLL:REC:warc',
            'r:USER:COLL:REC:cdxj',
            'r:USER:COLL:REC:info',
            'c:USER:COLL:info',
            'u:USER:info'
        ])

        resp.charset = 'utf-8'
        assert '"foo": "bar"' in resp.text

        size = self.redis.hget('r:USER:COLL:REC:info', 'size')
        assert size is not None
        assert size == self.redis.hget('c:USER:COLL:info', 'size')
        assert size == self.redis.hget('u:USER:info', 'size')

        assert self.redis.hget('r:USER:COLL:REC:info', 'updated_at') is not None

    def test_multi_user_rec_2(self):
        resp = self._test_warc_write('http://httpbin.org/get?boo=far', user='USER', coll='COLL', rec='REC2')

        keys = self.redis.keys()

        assert set(keys) == set([
            'r:USER:COLL:REC:warc',
            'r:USER:COLL:REC2:warc',
            'r:USER:COLL:REC:cdxj',
            'r:USER:COLL:REC2:cdxj',
            'r:USER:COLL:REC:info',
            'r:USER:COLL:REC2:info',
            'c:USER:COLL:info',
            'u:USER:info'
        ])

        resp.charset = 'utf-8'
        assert '"boo": "far"' in resp.text

