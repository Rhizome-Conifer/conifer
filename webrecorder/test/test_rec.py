from fakeredis import FakeStrictRedis

#from .testutils import BaseWRTests
from .testutils import FullStackTests

from pywb.warcserver.test.testutils import LiveServerTests

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

    @classmethod
    def teardown_class(cls):
        cls.wr_rec.writer.close()
        super(TestWebRecRecorder, cls).teardown_class()

    def _test_warc_write(self, url, user, coll, rec):
        parts = urlsplit(url)
        host = parts.netloc
        path = parts.path
        if parts.query:
            path += '?' + parts.query

        # Rec must be open
        #self.redis.hset('r:{user}:{coll}:{rec}:info'.format(user=user, coll=coll, rec=rec), 'id', rec)
        self.redis.setex('r:{rec}:open'.format(user=user, coll=coll, rec=rec), 30, 1)
        self.redis.hset('u:{user}:info'.format(user=user), 'size', 0)
        self.redis.hset('u:{user}:info'.format(user=user), 'max_size', 10000)

        req_url = '/record/live/resource/postreq?url={url}&param.recorder.user={user}&param.recorder.coll={coll}&param.recorder.rec={rec}'
        req_url = req_url.format(url=quote(url), user=user, coll=coll, rec=rec)
        resp = self.testapp.post(req_url, general_req_data.format(host=host, path=path).encode('utf-8'))

        while not self.wr_rec.recorder.write_queue.empty():
            self.wr_rec.recorder._write_one()

        assert resp.headers['Warcserver-Source-Coll'] == 'live'

        return resp

    def test_multi_user_rec(self):
        resp = self._test_warc_write('http://httpbin.org/get?foo=bar', user='USER', coll='COLL', rec='REC')

        keys = self.redis.keys()

        assert set(keys) == set([
            'r:REC:wk',
            'r:REC:cdxj',
            'r:REC:info',
            'r:REC:open',
            'r:REC:_ps',
            'r:REC:_pc',
            'c:COLL:info',
            'c:COLL:warc',
            'u:USER:info'
        ])

        resp.charset = 'utf-8'
        assert '"foo": "bar"' in resp.text

        size = self.redis.hget('r:REC:info', 'size')
        assert size is not None
        assert size == self.redis.hget('c:COLL:info', 'size')
        assert size == self.redis.hget('u:USER:info', 'size')

        assert self.redis.hget('r:REC:info', 'updated_at') is not None

    def test_multi_user_rec_2(self):
        resp = self._test_warc_write('http://httpbin.org/get?boo=far', user='USER', coll='COLL', rec='REC2')

        keys = self.redis.keys()

        assert set(keys) == set([
            'r:REC:wk',
            'r:REC:cdxj',
            'r:REC:info',
            'r:REC:open',
            'r:REC:_ps',
            'r:REC:_pc',
            'r:REC2:wk',
            'r:REC2:cdxj',
            'r:REC2:info',
            'r:REC2:open',
            'r:REC2:_ps',
            'r:REC2:_pc',
            'c:COLL:info',
            'c:COLL:warc',
            'u:USER:info'
        ])

        resp.charset = 'utf-8'
        assert '"boo": "far"' in resp.text

