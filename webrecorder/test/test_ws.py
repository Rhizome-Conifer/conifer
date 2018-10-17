from .testutils import FullStackTests
from webrecorder.fullstackrunner import FullStackRunner

import os
import gevent
import websocket
import requests
import json


# ============================================================================
class TestWS(FullStackTests):
    @classmethod
    def setup_class(cls):
        super(TestWS, cls).setup_class(init_anon=False)

    @classmethod
    def custom_init(cls, kwargs):
        cls.runner = FullStackRunner(app_port=0, env_params=cls.runner_env_params)
        cls.app_port = cls.runner.app_serv.port

        cls.sesh = requests.session()

        cls.anon_user = None

    def get_url(self, url):
        return self.sesh.get('http://localhost:{0}'.format(self.app_port) + url)

    def post_json(self, url, json=None):
        return self.sesh.post('http://localhost:{0}'.format(self.app_port) + url,
                              json=json)

    def test_user_cred(self):
        res = self.post_json('/api/v1/auth/anon_user')
        TestWS.anon_user = res.json()['user']['username']

        self.assert_temp_user_sesh(TestWS.anon_user)

    def test_create_recording(self):
        self.set_uuids('Recording', ['rec'])

        #url = 'http://httpbin.org/drip'
        res = self.post_json('/api/v1/collections?user={user}'.format(user=self.anon_user), json={'title': 'temp'})
        assert res.json()['collection']

        res = self.post_json('/api/v1/recordings?user={user}&coll=temp'.format(user=self.anon_user), json={})
        assert res.json()['recording']
        assert res.json()['recording']['id'] == 'rec'

    def test_ws_record_init(self):
        TestWS.ws = websocket.WebSocket()
        TestWS.ws.connect('ws://localhost:{0}/_client_ws?user={user}&coll=temp&rec=rec&type=record'.format(self.app_port, user=self.anon_user),
                          header=['Cookie: __test_sesh=' + self.sesh.cookies['__test_sesh']])

        msg = json.loads(self.ws.recv())

        assert msg['size'] == 0
        assert msg['pending_size'] == 0
        assert msg['ws_type'] == 'status'

    def test_ws_record_update(self):
        res = self.get_url('/{user}/temp/rec/record/mp_/httpbin.org/get?foo=bar'.format(user=self.anon_user))

        def assert_size():
            msg = json.loads(self.ws.recv())

            assert msg['size'] > 0

        self.sleep_try(0.2, 10.0, assert_size)

    def test_ws_record_update_pending(self):
        def long_req():
            res = self.get_url('/{user}/temp/rec/record/mp_/httpbin.org/drip'.format(user=self.anon_user))

        gr = gevent.spawn(long_req)

        def assert_pending():
            msg = json.loads(self.ws.recv())

            assert msg['pending_size'] > 0

        self.sleep_try(0.2, 10.0, assert_pending)

        def assert_not_pending():
            msg = json.loads(self.ws.recv())

            assert msg['pending_size'] == 0

        self.sleep_try(0.2, 10.0, assert_not_pending)

    def test_ws_replay(self):
        replay_ws = websocket.WebSocket()
        replay_ws.connect('ws://localhost:{0}/_client_ws?user={user}&coll=temp'.format(self.app_port, user=self.anon_user),
                          header=['Cookie: __test_sesh=' + self.sesh.cookies['__test_sesh']])

        msg = json.loads(replay_ws.recv())

        assert msg['size'] > 0
        assert 'pending_size' not in msg
        assert msg['ws_type'] == 'status'

        replay_ws.close()

    def test_extract_1(self):
        self.set_uuids('Recording', ['ex', 'p-ex'])
        res = self.get_url('/_new/temp/ex/extract:ia/1996/http://geocities.com/'.format(user=self.anon_user))

        res = self.get_url('/{user}/temp/ex/extract:ia/1996mp_/http://geocities.com/'.format(user=self.anon_user))
        #assert res.status_code == 302
        #assert res.headers['Location'].endswith('/temp/extract-test-2/extract:ia/1996/http://geocities.com/')

        res = self.get_url('/{user}/temp/ex/extract:ia/1996mp_/http://geocities.com/'.format(user=self.anon_user))
        assert 'GeoCities' in res.text
        assert 'wbinfo.timestamp = "19961226' in res.text

    def test_ws_extract_update_with_stats(self):
        ex_ws = websocket.WebSocket()
        ex_ws.connect('ws://localhost:{0}/_client_ws?user={user}&coll=temp&rec=ex&type=extract&url=http://geocities.com/'.format(self.app_port, user=self.anon_user),
                      header=['Cookie: __test_sesh=' + self.sesh.cookies['__test_sesh']])

        def assert_size():
            msg = json.loads(ex_ws.recv())

            assert msg['size'] > 0
            assert msg['pending_size'] == 0
            assert msg['stats'] == {'ia': 1}
            assert msg['ws_type'] == 'status'


        self.sleep_try(0.2, 10.0, assert_size)

        ex_ws.close()
        self.ws.close()

