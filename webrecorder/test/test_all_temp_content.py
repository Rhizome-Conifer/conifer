#!/usr/bin/env python
# -*- coding: utf-8 -*-

from .testutils import FullStackTests

import glob
import os
import time

from fakeredis import FakeStrictRedis
from io import BytesIO

from pywb.cdx.cdxobject import CDXObject
from pywb.warc.cdxindexer import write_cdx_index

from re import sub
from six.moves.urllib.parse import urlsplit, quote

from webrecorder.session import Session
import gevent


# ============================================================================
class TestTempContent(FullStackTests):
    REDIS_KEYS = [
        'r:{user}:{coll}:{rec}:cdxj',
        'r:{user}:{coll}:{rec}:info',
        'r:{user}:{coll}:{rec}:page',
        'r:{user}:{coll}:{rec}:warc',
        'c:{user}:{coll}:info',
        'c:{user}:{coll}:recs',
        'u:{user}:info',
        'h:roles',
        'h:defaults',
        'h:temp-usage',
    ]

    def setup_class(cls, **kwargs):
        super(TestTempContent, cls).setup_class(**kwargs)

        from webrecorder.rec.tempchecker import run
        gevent.spawn(run)

    def _get_redis_keys(self, keylist, user, coll, rec):
        keylist = [key.format(user=user, coll=coll, rec=rec) for key in keylist]
        return keylist

    def _assert_rec_keys(self, user, coll, rec_list):
        exp_keys = []

        for rec in rec_list:
            exp_keys.extend(self._get_redis_keys(self.REDIS_KEYS, user, coll, rec))

        res_keys = self.redis.keys()

        assert set(exp_keys) == set(res_keys)

    def _assert_size_all_eq(self, user, coll, rec):
        r_info = 'r:{user}:{coll}:{rec}:info'.format(user=user, coll=coll, rec=rec)
        c_info = 'c:{user}:{coll}:info'.format(user=user, coll=coll)
        u_info = 'u:{user}:info'.format(user=user)

        size = self.redis.hget(r_info, 'size')
        assert size is not None
        assert size == self.redis.hget(c_info, 'size')
        assert size == self.redis.hget(u_info, 'size')

        assert self.redis.hget(r_info, 'updated_at') is not None

    def _get_anon(self, url, status=None):
        return self.testapp.get('/' + self.anon_user + url, status=status)

    def test_live_top_frame(self):
        res = self.testapp.get('/live/http://example.com/')
        res.charset = 'utf-8'
        assert '"http://example.com/"' in res.text
        assert '<iframe' in res.text

    def test_anon_record_1(self):
        #res = self._get_anon('/temp/my-recording/record/mp_/http://httpbin.org/get?food=bar')
        res = self.testapp.get('/$record/temp/my-recording/mp_/http://httpbin.org/get?food=bar')
        assert res.status_code == 302
        res = res.follow()

        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'ts': '2016010203000000'}
        res = self.testapp.post('/api/v1/recordings/my-recording/pages?user={user}&coll=temp'.format(user=self.anon_user), params=page)

        assert res.json == {}

        user = self.anon_user

        self._assert_rec_keys(user, 'temp', ['my-recording'])

        self._assert_size_all_eq(user, 'temp', 'my-recording')

        warc_key = 'r:{user}:{coll}:{rec}:warc'.format(user=user, coll='temp', rec='my-recording')
        assert self.redis.hlen(warc_key) == 1

    def test_anon_replay_1(self):
        #print(self.redis.hgetall('c:' + self.anon_user + ':temp:warc'))

        res = self._get_anon('/temp/my-recording/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_anon_replay_coll_1(self):
        res = self._get_anon('/temp/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_anon_record_sanitize_redir(self):
        res = self._get_anon('/temp/My%20Rec2/record/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert self.testapp.cookies['__test_sesh'] != ''
        assert res.headers['Location'].endswith('/temp/my-rec2/record/http://httpbin.org/get?bood=far')

        res = self.testapp.get('/api/v1/recordings/my-rec2?user={user}&coll=temp'.format(user=self.anon_user))
        assert res.json['recording']['id'] == 'my-rec2'
        assert res.json['recording']['title'] == 'My Rec2'

    def test_anon_record_top_frame(self):
        res = self._get_anon('/temp/my-rec2/record/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"record"' in res.text
        assert '"rec_id": "my-rec2"' in res.text
        assert '"rec_title": "My Rec2"' in res.text
        assert '"coll_id": "temp"' in res.text
        assert '"coll_title": "Temporary Collection"' in res.text

    def test_anon_record_2(self):
        res = self._get_anon('/temp/my-rec2/record/mp_/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?bood=far', 'ts': '2016010203000000'}
        res = self.testapp.post('/api/v1/recordings/my-rec2/pages?user={user}&coll=temp'.format(user=self.anon_user), params=page)

        assert res.json == {}

        user = self.anon_user

        self._assert_rec_keys(user, 'temp', ['my-recording', 'my-rec2'])

        print(os.path.isdir(self.warcs_dir))

        anon_dir = os.path.join(self.warcs_dir, user)
        #assert set(os.listdir(anon_dir)) == set(['my-recording', 'my-rec2'])
        assert len(os.listdir(anon_dir)) == 2

        warc_key = 'r:{user}:{coll}:{rec}:warc'.format(user=user, coll='temp', rec='my-rec2')
        assert self.redis.hlen(warc_key) == 1

    def test_anon_unicode_record_1(self):
        test_url = 'http://httpbin.org/get?bood=far'
        res = self._get_anon(
            '/temp/{rec}/record/mp_/{url}'.format(rec=quote('вэбрекордэр'), url=test_url)
        )
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'вэбрекордэр!', 'url': test_url, 'ts': '2016010203000000'}
        res = self.testapp.post(
            '/api/v1/recordings/{rec}/pages?user={user}&coll=temp'.format(rec=quote('вэбрекордэр'), user=self.anon_user),
            params=page
        )

        assert res.json == {}

        user = self.anon_user

        self._assert_rec_keys(user, 'temp', ['my-recording', 'my-rec2', 'вэбрекордэр'])

        anon_dir = os.path.join(self.warcs_dir, user)
        assert len(os.listdir(anon_dir)) == 3

        warc_key = 'r:{user}:{coll}:{rec}:warc'.format(user=user, coll='temp', rec='вэбрекордэр')
        assert self.redis.hlen(warc_key) == 1

        # test non-protocol url replay routing
        res = self._get_anon(
            '/temp/{rec}/{url}'.format(rec=quote('вэбрекордэр'), url=sub(r'^http://', '', test_url))
        )
        res.charset = 'utf-8'

        # accessing the url should route to the replay
        assert res.status_code == 200
        assert '<iframe' in res.text

    def test_anon_new_add_to_recording(self):
        res = self._get_anon('/temp/my-rec2/$add')
        res.charset = 'utf-8'

        assert '<iframe' not in res.text

        assert 'My Rec2' in res.text

    def test_anon_new_recording(self):
        res = self._get_anon('/temp/$new')
        res.charset = 'utf-8'

        assert '<iframe' not in res.text

        assert 'Temporary%20Collection' in res.text

    def test_anon_user_info_redirect(self):
        res = self._get_anon('')
        assert res.status_code == 302
        assert res.headers['Location'].endswith('/' + self.anon_user + '/temp')

    def test_anon_coll_info(self):
        res = self._get_anon('/temp')
        res.charset = 'utf-8'

        assert 'My Rec2' in res.text
        assert 'my-recording' in res.text
        assert 'Temporary Collection' in res.text

        assert 'http://httpbin.org/get?food=bar' in res.text
        assert 'http://httpbin.org/get?bood=far' in res.text

    def test_anon_rec_info(self):
        res = self._get_anon('/temp/my-rec2')
        res.charset = 'utf-8'

        assert 'My Rec2' in res.text
        assert 'Example Title' in res.text
        assert 'Temporary Collection' in res.text

        assert '/http://httpbin.org/get?food=bar' in res.text
        assert '/http://httpbin.org/get?bood=far' in res.text

    def test_anon_replay_top_frame(self):
        res = self._get_anon('/temp/my-rec2/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"replay"' in res.text
        assert '"rec_id": "my-rec2"' in res.text
        assert '"rec_title": "My Rec2"' in res.text
        assert '"coll_id": "temp"' in res.text
        assert '"coll_title": "Temporary Collection"' in res.text

    def test_anon_replay_coll_top_frame(self):
        res = self._get_anon('/temp/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"replay-coll"' in res.text
        assert '"rec_id"' not in res.text
        assert '"rec_title"' not in res.text
        assert '"coll_id": "temp"' in res.text
        assert '"coll_title": "Temporary Collection"' in res.text

    def test_anon_download_rec(self):
        res = self._get_anon('/temp/my-rec2/$download')

        assert res.headers['Content-Disposition'].startswith("attachment; filename*=UTF-8''my-rec2-")

        warcin = self._get_dechunked(res.body)

        cdxout = BytesIO()
        write_cdx_index(cdxout, warcin, 'My-Rec2.warc.gz', include_all=True, cdxj=True)

        cdx = [CDXObject(cdx) for cdx in cdxout.getvalue().rstrip().split(b'\n')]
        assert len(cdx) == 2

        # response
        cdx[0]['url'] = 'http://httpbin.org/get?food=bar'
        cdx[0]['mime'] = 'application/json'

        # request
        cdx[1]['url'] = 'http://httpbin.org/get?food=bar'
        cdx[1]['mime'] = '-'

    def test_anon_download_coll(self):
        res = self._get_anon('/temp/$download')

        assert res.headers['Content-Disposition'].startswith("attachment; filename*=UTF-8''temp-")

        warcin = self._get_dechunked(res.body)

        cdxout = BytesIO()
        write_cdx_index(cdxout, warcin, 'temp.warc.gz', include_all=True, cdxj=True)

        cdx = [CDXObject(cdx) for cdx in cdxout.getvalue().rstrip().split(b'\n')]
        assert len(cdx) == 6

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

        res = self.testapp.delete('/api/v1/recordings/my-recording?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'my-recording'}

        res = self.testapp.delete('/api/v1/recordings/{rec}?user={user}&coll=temp'.format(rec=quote('вэбрекордэр'), user=self.anon_user))

        assert res.json == {'deleted_id': 'вэбрекордэр'}

        user = self.anon_user

        time.sleep(3.0)

        self._assert_size_all_eq(user, 'temp', 'my-rec2')

        anon_dir = os.path.join(self.warcs_dir, user)
        #assert set(os.listdir(anon_dir)) == set(['my-rec2'])
        assert len(os.listdir(anon_dir)) == 1

        warc_key = 'r:{user}:{coll}:{rec}:warc'.format(user=user, coll='temp', rec='my-rec2')
        assert self.redis.hlen(warc_key) == 1

        self._assert_rec_keys(user, 'temp', ['my-rec2'])

        res = self.testapp.delete('/api/v1/recordings/my-recording?user={user}&coll=temp'.format(user=self.anon_user), status=404)

        assert res.json == {'id': 'my-recording', 'error_message': 'Recording not found'}

    def test_anon_record_redirect_and_delete(self):
        res = self.testapp.get('/record/mp_/http://example.com/')
        assert res.status_code == 302

        parts = urlsplit(res.headers['Location'])

        path_parts = parts.path.split('/', 2)
        assert self.anon_user == path_parts[1]

        assert self.anon_user.startswith(Session.temp_prefix)
        assert parts.path.endswith('/temp/recording-session/record/mp_/http://example.com/')

        # Delete this recording
        res = self.testapp.delete('/api/v1/recordings/recording-session?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'recording-session'}

    def test_anon_patch_redirect_and_delete(self):
        res = self.testapp.get('/$patch/temp/http://example.com/?patch=test')
        assert res.status_code == 302

        parts = urlsplit(res.headers['Location'])
        path_parts = parts.path.split('/', 2)
        assert self.anon_user == path_parts[1]

        assert self.anon_user.startswith(Session.temp_prefix)

        assert res.headers['Location'].endswith('/temp/patch/patch/http://example.com/?patch=test')

        # Delete this recording
        res = self.testapp.delete('/api/v1/recordings/patch?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'patch'}

    def test_error_anon_not_found_recording(self):
        res = self._get_anon('/temp/my-rec/mp_/http://example.com/', status=404)
        assert res.status_code == 404

    def test_error_anon_not_found_coll_url(self):
        res = self._get_anon('/temp/mp_/http://example.com/', status=404)
        assert res.status_code == 404

    def test_error_anon_invalid_rec_name_redir(self):
        res = self._get_anon('/temp/mp_/example.com', status=302)
        assert res.headers['Location'].endswith('/' + self.anon_user + '/temp/mp_-/example.com')
        assert res.status_code == 302

    #def test_edge_anon_not_rec_name(self):
    #    res = self._get_anon('/temp/example.com/')
    #    res.charset = 'utf-8'
    #    assert '"http://example.com/"' in res.text
    #    assert '<iframe' in res.text

    def test_error_anon_not_found_recording_url(self):
        res = self._get_anon('/temp/my-recording/mp_/http://example.com/', status=404)
        assert res.status_code == 404

    def test_error_anon_invalid_coll(self):
        res = self._get_anon('/temp2/my-recording/record/mp_/http://httpbin.org/get?food=bar', status=404)
        assert res.status_code == 404

    def test_anon_auto_delete(self):
        sesh_redis = FakeStrictRedis.from_url('redis://localhost:6379/0')
        sesh_redis.flushdb()

        time.sleep(4.0)

        assert set(self.redis.keys()) == set(['h:roles', 'h:defaults', 'h:temp-usage'])

        assert glob.glob(os.path.join(self.warcs_dir, 'temp$*')) == []
        #assert os.listdir(os.path.join(self.warcs_dir, 'anon')) == []
