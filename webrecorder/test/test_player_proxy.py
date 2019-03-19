from .testutils import TempDirTests, BaseTestClass, FakeStrictRedis

from io import BytesIO

from webrecorder.standalone.webrecorder_player import webrecorder_player

import os
import requests
import gzip
import json
import websocket

from tempfile import NamedTemporaryFile

from warcio.timeutils import timestamp_to_iso_date
from warcio.warcwriter import WARCWriter
from warcio.statusandheaders import StatusAndHeaders


# ============================================================================
class BaseTestPlayer(BaseTestClass):
    @classmethod
    def setup_class(cls):
        cls.env_backup = dict(os.environ)

        super(BaseTestPlayer, cls).setup_class()
        cls.session = requests.session()

        cls.warc_path = cls.create_temp_warc()

        cls.player = webrecorder_player(cls.get_player_cmd(), embed=True)
        cls.app_port = cls.player.app_serv.port
        cls.app_host = 'http://localhost:' + str(cls.app_port)
        cls.proxies = {'http': cls.app_host, 'https': cls.app_host}

        cls.redis = FakeStrictRedis(db=1, decode_responses=True)

    @classmethod
    def get_player_cmd(cls):
        return ['--no-browser', '-p', '0', cls.warc_path]

    @classmethod
    def teardown_class(cls):
        os.remove(cls.warc_path)

        cls.player.app_serv.stop()

        cls.redis.flushall()

        super(BaseTestPlayer, cls).teardown_class()

        os.environ.clear()
        os.environ.update(cls.env_backup)

    @classmethod
    def create_temp_warc(cls):
        with NamedTemporaryFile(delete=False, suffix='.warc.gz') as fh:
            writer = WARCWriter(fh, gzip=True)

            cls.create_record(writer, 'http://example.com/', 'Example Domain', '20140101000000')
            cls.create_record(writer, 'http://example.com/', 'Example Domain', '20170101000000')

            filename = fh.name

        return filename

    @classmethod
    def create_record(cls, writer, url, text, timestamp):
        payload = text.encode('utf-8')

        headers_list = [('Content-Type', 'text/plain; charset="UTF-8"'),
                        ('Content-Length', str(len(payload)))
                       ]

        http_headers = StatusAndHeaders('200 OK', headers_list, protocol='HTTP/1.0')

        warc_headers = {}
        if timestamp:
            warc_headers['WARC-Date'] = timestamp_to_iso_date(timestamp)

        rec = writer.create_warc_record(url, 'response',
                                         payload=BytesIO(payload),
                                         length=len(payload),
                                         http_headers=http_headers,
                                         warc_headers_dict=warc_headers)

        writer.write_record(rec)


# ============================================================================
class TestPlayer(BaseTestPlayer):
    def test_wait_for_init(self):
        def assert_finished():
            res = self.session.get(self.app_host + '/_upload/@INIT?user=local')
            assert res.json()['done'] == True
            assert res.json()['size'] >= res.json()['total_size']

        count = 0
        while True:
            try:
                assert_finished()
                break
            except AssertionError:
                if count >= 25:
                    raise

                count += 1
                time.sleep(0.2)

    def test_coll_is_public(self):
        res = self.session.get(self.app_host + '/api/v1/collection/collection?user=local')
        collection = res.json()['collection']
        assert collection['public'] == True
        assert collection['public_index'] == True

    def test_proxy_home_redirect_to_coll(self):
        res = self.session.get(self.app_host + '/', allow_redirects=True)

        # one redirect
        assert len(res.history) == 1

        # final url collection
        assert res.status_code == 200
        assert res.url.endswith('/local/collection')

    # non-proxy replay, Timestamp specified explicitly
    def test_rewrite_replay_latest(self):
        res = self.session.get(self.app_host + '/local/collection/mp_/http://example.com/')
        assert res.headers['Content-Type'] == 'text/plain; charset="UTF-8"'
        assert res.text == 'Example Domain'
        assert res.headers['Memento-Datetime'] == 'Sun, 01 Jan 2017 00:00:00 GMT'

    def test_rewrite_replay_at_ts(self):
        res = self.session.get(self.app_host + '/local/collection/2014mp_/http://example.com/')
        assert res.headers['Content-Type'] == 'text/plain; charset="UTF-8"'
        assert res.text == 'Example Domain'
        assert res.headers['Memento-Datetime'] == 'Wed, 01 Jan 2014 00:00:00 GMT'

    # proxy replay, default to most recent capture
    def test_proxy_replay_latest(self):
        res = self.session.get('http://example.com/', proxies=self.proxies)
        assert res.headers['Content-Type'] == 'text/plain; charset="UTF-8"'
        assert res.text == 'Example Domain'
        assert res.headers['Memento-Datetime'] == 'Sun, 01 Jan 2017 00:00:00 GMT'

    # switch timestamp
    def test_switch_date_0(self):
        params = {'user': 'local',
                  'coll': 'collection',
                  'timestamp': '2018'
                 }
        res = self.session.get(self.app_host + '/api/v1/update_remote_browser/@INIT', params=params)
        assert res.json() == {}

    # switch timestamp multiple times
    def test_switch_date(self):
        params = {'user': 'local',
                  'coll': 'collection',
                  'timestamp': '20140101000000'
                 }
        res = self.session.get(self.app_host + '/api/v1/update_remote_browser/@INIT', params=params)
        assert res.json() == {}

    # confirm using older timestamp
    def test_proxy_replay_new_date(self):
        res = self.session.get('http://example.com/', proxies=self.proxies)
        assert res.headers['Content-Type'] == 'text/plain; charset="UTF-8"'
        assert res.text == 'Example Domain'
        assert res.headers['Memento-Datetime'] == 'Wed, 01 Jan 2014 00:00:00 GMT'

    # proxy replay, set timestamp via replay url, then redirect
    def test_proxy_redirect_date_1(self):
        res = self.session.get('http://webrecorder.proxy/local/collection/2017/http://example.com/', proxies=self.proxies)
        assert res.headers['Content-Type'] == 'text/plain; charset="UTF-8"'
        assert res.text == 'Example Domain'
        assert res.url == 'http://example.com/'
        assert res.headers['Memento-Datetime'] == 'Sun, 01 Jan 2017 00:00:00 GMT'

    def test_proxy_redirect_date_2(self):
        res = self.session.get('http://webrecorder.proxy/local/collection/2014/http://example.com/', proxies=self.proxies)
        assert res.headers['Content-Type'] == 'text/plain; charset="UTF-8"'
        assert res.text == 'Example Domain'
        assert res.url == 'http://example.com/'
        assert res.headers['Memento-Datetime'] == 'Wed, 01 Jan 2014 00:00:00 GMT'

    def test_proxy_static(self):
        res = self.session.get('http://webrecorder.proxy/static/bundle/proxy.js', proxies=self.proxies)
        assert res.status_code == 200
        assert 'wombat' in res.text

        assert 'Access-Control-Allow-Origin' not in res.headers

    def test_proxy_static_cors(self):
        res = self.session.get('http://webrecorder.proxy/static_cors/bundle/proxy.js', proxies=self.proxies,
                               headers={'Origin': 'http://example.com/'})

        assert res.status_code == 200
        assert 'wombat' in res.text

        assert res.headers['Access-Control-Allow-Origin'] == '*'

    def test_proxy_static_err(self):
        res = self.session.get('http://webrecorder.proxy/static_cors/bundle/not-found-x', proxies=self.proxies)
        assert res.status_code == 404
        assert 'No such page' in res.text

    def test_ws_init(self):
        ws = websocket.WebSocket()
        ws.connect('ws://localhost:{0}/_client_ws_cont'.format(self.app_port))
        ws.close()

    def test_redis_keys(self):
        colls = self.redis.hgetall('u:local:colls')
        assert len(colls) == 1
        assert colls['collection']

        assert self.redis.ttl('c:{0}:cdxj'.format(colls['collection'])) == -1
        assert self.redis.keys('r:*:cdxj') == []


# ============================================================================
class TestCacheingPlayer(TestPlayer):
    @classmethod
    def setup_class(cls):
        super(TestCacheingPlayer, cls).setup_class()

        name = os.path.basename(cls.warc_path) + '-cache.json.gz'
        path = os.path.join(os.path.dirname(cls.warc_path),
                            '_warc_cache',
                            name)

        cls.cache_path = path

    @classmethod
    def teardown_class(cls):
        os.remove(cls.cache_path)
        super(TestCacheingPlayer, cls).teardown_class()

    @classmethod
    def get_player_cmd(cls):
        return ['--no-browser', '-p', '0', cls.warc_path, '--cache-dir', '_warc_cache']

    def test_cache_create(self):
        assert os.path.isfile(self.cache_path)

        with gzip.open(self.cache_path, 'rt') as fh:
            cache = json.loads(fh.read())

        assert cache['version'] == '2.1'



