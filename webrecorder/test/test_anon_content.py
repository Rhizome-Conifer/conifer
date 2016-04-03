from gevent.monkey import patch_all; patch_all()

import os
import time

from gevent.wsgi import WSGIServer
import gevent

from .testutils import BaseWRTests
from fakeredis import FakeStrictRedis


# ============================================================================
class TestAnonContent(BaseWRTests):
    REDIS_KEYS = [
        'r:{user}:{coll}:{rec}:cdxj',
        'r:{user}:{coll}:{rec}:info',
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

        os.environ['REDIS_BASE_URL'] = 'redis://localhost:6379/2'
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
        server = WSGIServer(('', port), app)
        #port = server.socket.getsockname()[1]

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
        assert res.headers['Location'].endswith('/anonymous/my-recording/record/mp_/http://example.com/')

    def test_anon_replay_redirect(self):
        res = self.testapp.get('/replay/mp_/http://example.com/')
        assert res.status_code == 302
        assert res.headers['Location'].endswith('/anonymous/mp_/http://example.com/')

    def test_anon_record_1(self):
        res = self.testapp.get('/anonymous/my-recording/record/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        user = self.get_anon_user()

        self._assert_rec_keys(user, 'anonymous', ['my-recording'])

        r_info = 'r:{user}:{coll}:{rec}:info'.format(user=user, coll='anonymous', rec='my-recording')
        c_info = 'c:{user}:{coll}:info'.format(user=user, coll='anonymous')
        u_info = 'u:{user}'.format(user=user)

        size = self.redis.hget(r_info, 'size')
        assert size is not None
        assert size == self.redis.hget(c_info, 'size')
        assert size == self.redis.hget(u_info, 'size')

        assert self.redis.hget(r_info, 'updated_at') is not None

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

    def test_anon_record_2(self):
        res = self.testapp.get('/anonymous/my-rec2/record/mp_/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        user = self.get_anon_user()

        self._assert_rec_keys(user, 'anonymous', ['my-recording', 'my-rec2'])

        anon_dir = os.path.join(self.warcs_dir, user, 'anonymous')
        assert set(os.listdir(anon_dir)) == set(['my-recording', 'my-rec2'])

        warc_key = 'c:{user}:{coll}:warc'.format(user=user, coll='anonymous')
        assert self.redis.hlen(warc_key) == 2

    def test_anon_delete_rec(self):
        time.sleep(0.1)

        res = self.testapp.delete('/api/v1/recordings/my-recording?user=@anon&coll=anonymous')

        user = self.get_anon_user()

        time.sleep(0.8)

        anon_dir = os.path.join(self.warcs_dir, user, 'anonymous')
        assert set(os.listdir(anon_dir)) == set(['my-rec2'])

        warc_key = 'c:{user}:{coll}:warc'.format(user=user, coll='anonymous')
        assert self.redis.hlen(warc_key) == 1

        self._assert_rec_keys(user, 'anonymous', ['my-rec2'])

    def test_anon_record_sanitize_redir(self):
        res = self.testapp.get('/anonymous/My%20Recording/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert self.testapp.cookies['__test_sesh'] != ''
        assert res.headers['Location'].endswith('/anonymous/my-recording/http://httpbin.org/get?bood=far')

    def test_error_anon_not_found_recording(self):
        res = self.testapp.get('/anonymous/my-rec/mp_/http://example.com/', status=404)
        assert res.status_code == 404

    def test_error_anon_not_found_coll_url(self):
        res = self.testapp.get('/anonymous/mp_/http://example.com/', status=404)
        assert res.status_code == 404

    def test_edge_anon_invalid_rec_name_redir(self):
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

