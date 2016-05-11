from gevent.monkey import patch_all; patch_all()

import os
import time

from io import BytesIO

from pywb.cdx.cdxobject import CDXObject
from pywb.warc.cdxindexer import write_cdx_index
from pywb.utils.bufferedreaders import ChunkedDataReader

from gevent.wsgi import WSGIServer
import gevent

from .testutils import BaseWRTests
from fakeredis import FakeStrictRedis


# ============================================================================
class TestAnonContent(BaseWRTests):
    REDIS_KEYS = [
        'r:{user}:{coll}:{rec}:cdxj',
        'r:{user}:{coll}:{rec}:info',
        'r:{user}:{coll}:{rec}:page',
        'c:{user}:{coll}:warc',
        'c:{user}:{coll}:info',
        'u:{user}',
        'h:roles',
        'h:defaults',
    ]

    @classmethod
    def setup_class(cls):
        agg_port = 30080
        rec_port = 30090

        os.environ['WEBAGG_HOST'] = 'http://localhost:{0}'.format(agg_port)
        os.environ['RECORD_HOST'] = 'http://localhost:{0}'.format(rec_port)

        os.environ['ANON_SLEEP_CHECK'] = '5'

        super(TestAnonContent, cls).setup_class()

        cls.init_webagg(agg_port)
        cls.init_rec(agg_port, rec_port)

    def _get_redis_keys(self, keylist, user, coll, rec):
        keylist = [key.format(user=user, coll=coll, rec=rec) for key in keylist]
        return keylist

    @classmethod
    def init_webagg(cls, port):
        from wrwebagg.wragg import application as webaggapp
        port = cls.make_gevent_server(webaggapp, port)

    @classmethod
    def init_rec(cls, agg_port, rec_port):
        from wrrecorder.main import application as recapp
        port = cls.make_gevent_server(recapp, rec_port)

    @classmethod
    def make_gevent_server(cls, app, port=0):
        server = WSGIServer(('localhost', port), app)

        def run(server):
            print('starting server on ' + str(port))
            server.serve_forever()

        gevent.spawn(run, server)
        return port

    def _assert_rec_keys(self, user, coll, rec_list):
        exp_keys = []

        for rec in rec_list:
            exp_keys.extend(self._get_redis_keys(self.REDIS_KEYS, user, coll, rec))

        res_keys = self.redis.keys()
        res_keys = [k.decode('utf-8') for k in res_keys]

        assert set(exp_keys) == set(res_keys)

    def _assert_size_all_eq(self, user, coll, rec):
        r_info = 'r:{user}:{coll}:{rec}:info'.format(user=user, coll=coll, rec=rec)
        c_info = 'c:{user}:{coll}:info'.format(user=user, coll=coll)
        u_info = 'u:{user}'.format(user=user)

        size = self.redis.hget(r_info, 'size')
        assert size is not None
        assert size == self.redis.hget(c_info, 'size')
        assert size == self.redis.hget(u_info, 'size')

        assert self.redis.hget(r_info, 'updated_at') is not None

    def _get_dechunked(self, stream):
        buff = ChunkedDataReader(BytesIO(stream))

        warcin = BytesIO()
        while True:
            b = buff.read()
            if not b:
                break
            warcin.write(b)

        warcin.seek(0)
        return warcin

    def test_live(self):
        res = self.testapp.get('/live/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert self.testapp.cookies.get('__test_sesh', '') == ''

        assert '"food": "bar"' in res.text, res.text

    def test_live_top_frame(self):
        res = self.testapp.get('/live/http://example.com/')
        res.charset = 'utf-8'
        assert '"http://example.com/"' in res.text
        assert '<iframe' in res.text

    def test_anon_record_redirect(self):
        res = self.testapp.get('/record/mp_/http://example.com/')
        assert res.status_code == 302
        assert res.headers['Location'].endswith('/anonymous/My First Recording/record/mp_/http://example.com/')

    def test_anon_replay_redirect(self):
        res = self.testapp.get('/replay/mp_/http://example.com/')
        assert res.status_code == 302
        assert res.headers['Location'].endswith('/anonymous/mp_/http://example.com/')

    def test_anon_record_1(self):
        res = self.testapp.get('/anonymous/my-recording/record/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'ts': '2016010203000000'}
        res = self.testapp.post('/api/v1/recordings/my-recording/pages?user=@anon&coll=anonymous', params=page)

        assert res.json == {}

        user = self.get_anon_user()

        self._assert_rec_keys(user, 'anonymous', ['my-recording'])

        self._assert_size_all_eq(user, 'anonymous', 'my-recording')

        warc_key = 'c:{user}:{coll}:warc'.format(user=user, coll='anonymous')
        assert self.redis.hlen(warc_key) == 1

    def test_anon_replay_1(self):
        res = self.testapp.get('/anonymous/my-recording/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_anon_replay_coll_1(self):
        res = self.testapp.get('/anonymous/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_anon_record_sanitize_redir(self):
        res = self.testapp.get('/anonymous/My%20Rec2/record/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert self.testapp.cookies['__test_sesh'] != ''
        assert res.headers['Location'].endswith('/anonymous/my-rec2/record/http://httpbin.org/get?bood=far')

        res = self.testapp.get('/api/v1/recordings/my-rec2?user=@anon&coll=anonymous')
        assert res.json['recording']['id'] == 'my-rec2'
        assert res.json['recording']['title'] == 'My Rec2'

    def test_anon_record_top_frame(self):
        res = self.testapp.get('/anonymous/my-rec2/record/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"record"' in res.text
        assert '"rec_id": "my-rec2"' in res.text
        assert '"rec_title": "My Rec2"' in res.text
        assert '"coll_id": "anonymous"' in res.text
        assert '"coll_title": "anonymous"' in res.text

    def test_anon_record_2(self):
        res = self.testapp.get('/anonymous/my-rec2/record/mp_/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?bood=far', 'ts': '2016010203000000'}
        res = self.testapp.post('/api/v1/recordings/my-rec2/pages?user=@anon&coll=anonymous', params=page)

        assert res.json == {}

        user = self.get_anon_user()

        self._assert_rec_keys(user, 'anonymous', ['my-recording', 'my-rec2'])

        anon_dir = os.path.join(self.warcs_dir, user, 'anonymous')
        assert set(os.listdir(anon_dir)) == set(['my-recording', 'my-rec2'])

        warc_key = 'c:{user}:{coll}:warc'.format(user=user, coll='anonymous')
        assert self.redis.hlen(warc_key) == 2

    def test_anon_new_add_to_recording(self):
        res = self.testapp.get('/anonymous/my-rec2/$add')
        res.charset = 'utf-8'

        assert '"My Rec2"' in res.text

    def test_anon_new_recording(self):
        res = self.testapp.get('/anonymous/$new')
        res.charset = 'utf-8'

        assert '"anonymous"' in res.text

    def test_anon_coll_info(self):
        res = self.testapp.get('/anonymous')
        res.charset = 'utf-8'

        assert 'My Rec2' in res.text
        assert 'my-recording' in res.text

        assert '/anonymous/my-recording/http://httpbin.org/get?food=bar' in res.text
        assert '/anonymous/my-rec2/http://httpbin.org/get?bood=far' in res.text


    def test_anon_rec_info(self):
        res = self.testapp.get('/anonymous/my-rec2')
        res.charset = 'utf-8'

        assert 'My Rec2' in res.text
        assert 'Example Title' in res.text

        assert '/anonymous/my-recording/http://httpbin.org/get?food=bar' not in res.text
        assert '/anonymous/my-rec2/http://httpbin.org/get?bood=far' in res.text

    def test_anon_replay_top_frame(self):
        res = self.testapp.get('/anonymous/my-rec2/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"replay"' in res.text
        assert '"rec_id": "my-rec2"' in res.text
        assert '"rec_title": "My Rec2"' in res.text
        assert '"coll_id": "anonymous"' in res.text
        assert '"coll_title": "anonymous"' in res.text

    def test_anon_replay_coll_top_frame(self):
        res = self.testapp.get('/anonymous/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"replay-coll"' in res.text
        assert '"rec_id"' not in res.text
        assert '"rec_title"' not in res.text
        assert '"coll_id": "anonymous"' in res.text
        assert '"coll_title": "anonymous"' in res.text

    def test_anon_download_rec(self):
        res = self.testapp.get('/anonymous/my-rec2/$download')

        assert res.headers['Content-Disposition'].startswith('attachment; filename=My%20Rec2-')

        warcin = self._get_dechunked(res.body)

        cdxout = BytesIO()
        write_cdx_index(cdxout, warcin, 'My-Rec2.warc.gz', include_all=True, cdxj=True)

        #print(cdxout.getvalue().decode('utf-8'))

        cdx = [CDXObject(cdx) for cdx in cdxout.getvalue().rstrip().split(b'\n')]
        assert len(cdx) == 2

        # response
        cdx[0]['url'] = 'http://httpbin.org/get?food=bar'
        cdx[0]['mime'] = 'application/json'

        # request
        cdx[1]['url'] = 'http://httpbin.org/get?food=bar'
        cdx[1]['mime'] = '-'

    def test_anon_download_coll(self):
        res = self.testapp.get('/anonymous/$download')

        assert res.headers['Content-Disposition'].startswith('attachment; filename=anonymous-')

        warcin = self._get_dechunked(res.body)

        cdxout = BytesIO()
        write_cdx_index(cdxout, warcin, 'anonymous.warc.gz', include_all=True, cdxj=True)

        #print(cdxout.getvalue().decode('utf-8'))

        cdx = [CDXObject(cdx) for cdx in cdxout.getvalue().rstrip().split(b'\n')]
        assert len(cdx) == 4

        # response
        cdx[0]['url'] = 'http://httpbin.org/get?food=bar'
        cdx[0]['mime'] = 'application/json'

        # request
        cdx[1]['url'] = 'http://httpbin.org/get?food=bar'
        cdx[1]['mime'] = '-'

        # response
        cdx[2]['url'] = 'http://httpbin.org/get?bood=far'
        cdx[2]['mime'] = 'application/json'

        # request
        cdx[3]['url'] = 'http://httpbin.org/get?bood=far'
        cdx[3]['mime'] = '-'

    def test_anon_delete_rec(self):
        #time.sleep(0.1)

        res = self.testapp.delete('/api/v1/recordings/my-recording?user=@anon&coll=anonymous')

        assert res.json == {'deleted_id': 'my-recording'}

        user = self.get_anon_user()

        time.sleep(1.0)

        self._assert_size_all_eq(user, 'anonymous', 'my-rec2')

        anon_dir = os.path.join(self.warcs_dir, user, 'anonymous')
        assert set(os.listdir(anon_dir)) == set(['my-rec2'])

        warc_key = 'c:{user}:{coll}:warc'.format(user=user, coll='anonymous')
        assert self.redis.hlen(warc_key) == 1

        self._assert_rec_keys(user, 'anonymous', ['my-rec2'])

        res = self.testapp.delete('/api/v1/recordings/my-recording?user=@anon&coll=anonymous', status=404)

        assert res.json == {'id': 'my-recording', 'error_message': 'Recording not found'}

    def test_error_anon_not_found_recording(self):
        res = self.testapp.get('/anonymous/my-rec/mp_/http://example.com/', status=404)
        assert res.status_code == 404

    def test_error_anon_not_found_coll_url(self):
        res = self.testapp.get('/anonymous/mp_/http://example.com/', status=404)
        assert res.status_code == 404

    def test_error_anon_invalid_rec_name_redir(self):
        res = self.testapp.get('/anonymous/mp_/example.com', status=302)
        assert res.headers['Location'].endswith('/anonymous/mp__/example.com')
        assert res.status_code == 302

    #def test_edge_anon_not_rec_name(self):
    #    res = self.testapp.get('/anonymous/example.com/')
    #    res.charset = 'utf-8'
    #    assert '"http://example.com/"' in res.text
    #    assert '<iframe' in res.text

    def test_error_anon_not_found_recording_url(self):
        res = self.testapp.get('/anonymous/my-recording/mp_/http://example.com/', status=404)
        assert res.status_code == 404

    def test_anon_auto_delete(self):
        sesh_redis = FakeStrictRedis.from_url('redis://localhost:6379/0')
        sesh_redis.flushdb()

        time.sleep(4.0)

        assert set(self.redis.keys()) == set([b'h:roles', b'h:defaults'])

        assert os.listdir(os.path.join(self.warcs_dir, 'anon')) == []

