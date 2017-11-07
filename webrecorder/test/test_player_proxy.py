from .testutils import TempDirTests, BaseTestClass, FakeRedisTests

from io import BytesIO

from webrecorder.standalone.webrecorder_player import webrecorder_player

import os
import requests

from tempfile import NamedTemporaryFile

from warcio.timeutils import timestamp_to_iso_date
from warcio.warcwriter import WARCWriter
from warcio.statusandheaders import StatusAndHeaders


# ============================================================================
class TestPlayer(BaseTestClass):
    @classmethod
    def setup_class(cls):
        super(TestPlayer, cls).setup_class()
        cls.session = requests.session()

        cls.warc_path = cls.create_temp_warc()

        cls.player = webrecorder_player(['--no-browser', cls.warc_path], embed=True)
        cls.app_host = 'http://localhost:' + str(cls.player.app_serv.port)
        cls.proxies = {'http': cls.app_host, 'https': cls.app_host}

    @classmethod
    def teardown_class(cls):
        os.remove(cls.warc_path)

        super(TestPlayer, cls).teardown_class()

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


