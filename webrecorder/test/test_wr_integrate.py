from gevent.monkey import patch_all; patch_all()

import os

from gevent.wsgi import WSGIServer
import gevent

from .testutils import BaseWRTests


# ============================================================================
class TestWebRecorder(BaseWRTests):

    REDIS_KEYS = [
        'c:{user}:{coll}:warc',
        'r:{user}:{coll}:{rec}:cdxj',
        'r:{user}:{coll}:{rec}:info',
        'c:{user}:{coll}',
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

        super(TestWebRecorder, cls).setup_class()

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

    @classmethod
    def get_anon_user(cls):
        anon_user = 'anon/' + cls.testapp.cookies['__test_sesh'][-32:]
        return anon_user

    def test_anon_rec_redirect(self):
        res = self.testapp.get('/record/mp_/http://example.com/')
        assert res.status_code == 302
        assert res.headers['Location'].endswith('/anonymous/my-recording/record/mp_/http://example.com/')

    def test_anon_record_1(self):
        res = self.testapp.get('/anonymous/my-recording/record/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        user = self.get_anon_user()

        key_templ = self.REDIS_KEYS

        exp_keys = self._get_redis_keys(key_templ, user, 'anonymous', 'my-recording')

        res_keys = self.redis.keys()
        res_keys = [k.decode('utf-8') for k in res_keys]

        assert set(exp_keys) == set(res_keys)

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

        exp_keys = self._get_redis_keys(self.REDIS_KEYS, user, 'anonymous', 'my-recording')
        exp_keys.extend(self._get_redis_keys(self.REDIS_KEYS, user, 'anonymous', 'my-rec2'))

        res_keys = self.redis.keys()
        res_keys = [k.decode('utf-8') for k in res_keys]

        assert set(exp_keys) == set(res_keys)

        anon_dir = os.path.join(self.warcs_dir, user, 'anonymous')
        assert set(os.listdir(anon_dir)) == set(['my-recording', 'my-rec2'])

    def test_error_anon_not_found_recording(self):
        res = self.testapp.get('/anonymous/my-rec/mp_/http://example.com/', status=404)
        assert res.status_code == 404

    def test_error_anon_not_found_coll_url(self):
        res = self.testapp.get('/anonymous/mp_/http://example.com/', status=404)
        assert res.status_code == 404

    def test_error_anon_not_found_recording_url(self):
        res = self.testapp.get('/anonymous/my-recording/mp_/http://example.com/', status=404)
        assert res.status_code == 404


