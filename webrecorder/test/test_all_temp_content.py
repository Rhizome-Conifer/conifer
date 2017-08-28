#!/usr/bin/env python
# -*- coding: utf-8 -*-

from .testutils import FullStackTests

import glob
import os

from fakeredis import FakeStrictRedis
from mock import patch

from io import BytesIO
from itertools import count

from pywb.warcserver.index.cdxobject import CDXObject
from pywb.indexer.cdxindexer import write_cdx_index

from re import sub
from six.moves.urllib.parse import urlsplit, quote

from webrecorder.session import Session

from webrecorder.rec.tempchecker import TempChecker
from webrecorder.rec.worker import Worker
import gevent


# ============================================================================
class TestTempContent(FullStackTests):
    REDIS_KEYS = [
        'r:{user}:{coll}:{rec}:cdxj',
        'r:{user}:{coll}:{rec}:open',
        'r:{user}:{coll}:{rec}:info',
        'r:{user}:{coll}:{rec}:page',
        'r:{user}:{coll}:{rec}:warc',
        'c:{user}:{coll}:info',
        'c:{user}:{coll}:recs',
        'u:{user}:info',
        'u:{user}:colls',
        'h:roles',
        'h:defaults',
        'h:temp-usage',
    ]

    PAGE_STATS = 'r:{user}:{coll}:{rec}:<sesh_id>:stats:{url}'


    @classmethod
    def setup_class(cls, **kwargs):
        super(TestTempContent, cls).setup_class(**kwargs)

        def make_id(self):
            sesh_id = 'sesh_id'
            redis_key = self.key_template.format(sesh_id)

            return sesh_id, redis_key

        cls.seshmock = patch('webrecorder.session.RedisSessionMiddleware.make_id', make_id)
        cls.seshmock.start()

        cls.dyn_stats = []

        cls.worker = Worker(TempChecker)
        gevent.spawn(cls.worker.run)

    @classmethod
    def teardown_class(cls, *args, **kwargs):
        cls.seshmock.stop()
        cls.worker.stop()

        super(TestTempContent, cls).teardown_class(*args, **kwargs)

    def _get_redis_keys(self, keylist, user, coll, rec):
        keylist = [key.format(user=user, coll=coll, rec=rec) for key in keylist]
        return keylist

    def _assert_rec_keys(self, user, coll, rec_list, url='', replay_coll=True):
        exp_keys = []

        for rec in rec_list:
            exp_keys.extend(self._get_redis_keys(self.REDIS_KEYS, user, coll, rec))

        if replay_coll:
            exp_keys.append('c:{user}:{coll}:cdxj'.format(user=user, coll=coll))

        if url:
            self._add_dyn_stat(user, coll, rec_list[-1], url)
        exp_keys.extend(self.dyn_stats)

        res_keys = self.redis.keys()

        assert set(exp_keys) == set(res_keys)

    def _add_dyn_stat(self, user, coll, rec, url):
        self.dyn_stats.append(self.PAGE_STATS.format(user=user, coll=coll,
                                                      rec=rec, url=url))

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
        res = self.testapp.get('/_new/temp/my-recording/record/mp_/http://httpbin.org/get?food=bar')
        assert res.status_code == 302
        assert res.location.endswith('/temp/my-recording/record/mp_/http://httpbin.org/get?food=bar')
        res = res.follow()

        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'ts': '2016010203000000'}
        res = self.testapp.post('/api/v1/recordings/my-recording/pages?user={user}&coll=temp'.format(user=self.anon_user), params=page)

        assert res.json == {}

        user = self.anon_user

        self._assert_rec_keys(user, 'temp', ['my-recording'], replay_coll=False)

        self._assert_size_all_eq(user, 'temp', 'my-recording')

        warc_key = 'r:{user}:{coll}:{rec}:warc'.format(user=user, coll='temp', rec='my-recording')
        assert self.redis.hlen(warc_key) == 1

    def test_anon_replay_1(self):
        #print(self.redis.hgetall('c:' + self.anon_user + ':temp:warc'))

        res = self._get_anon('/temp/my-recording/replay/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        self._assert_rec_keys(self.anon_user, 'temp', ['my-recording'], 'http://httpbin.org/get?food=bar', replay_coll=False)
        assert '"food": "bar"' in res.text, res.text

    def test_anon_replay_coll_1(self):
        res = self._get_anon('/temp/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        self._add_dyn_stat(self.anon_user, 'temp', '<all>', 'http://httpbin.org/get?food=bar')
        self._assert_rec_keys(self.anon_user, 'temp', ['my-recording'])
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

        anon_dir = os.path.join(self.warcs_dir, user)
        assert len(os.listdir(anon_dir)) == 2

        warc_key = 'r:{user}:{coll}:{rec}:warc'.format(user=user, coll='temp', rec='my-rec2')
        assert self.redis.hlen(warc_key) == 1

    def test_anon_record_3(self):
        res = self.testapp.get('/$record/temp/my-recording/mp_/http://httpbin.org/get?good=far')
        assert res.status_code == 302
        assert res.location.endswith('/temp/my-recording-2/record/mp_/http://httpbin.org/get?good=far')
        res = res.follow()

        res.charset = 'utf-8'

        assert '"good": "far"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?good=far', 'ts': '2016010203000000'}
        res = self.testapp.post('/api/v1/recordings/my-recording-2/pages?user={user}&coll=temp'.format(user=self.anon_user), params=page)

        assert res.json == {}

        user = self.anon_user

        self._assert_rec_keys(user, 'temp', ['my-recording', 'my-rec2', 'my-recording-2'])

        warc_key = 'r:{user}:{coll}:{rec}:warc'.format(user=user, coll='temp', rec='my-recording-2')
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

        all_recs = ['my-recording', 'my-recording-2', 'my-rec2', 'вэбрекордэр']

        self._assert_rec_keys(user, 'temp', all_recs)

        anon_dir = os.path.join(self.warcs_dir, user)
        assert len(os.listdir(anon_dir)) == len(all_recs)

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

    def test_anon_special_characters_record(self):
        test_url = 'http://httpbin.org/get?mood=bar'
        res = self.testapp.get(
            '/_new/temp/{rec}/record/mp_/{url}'.format(rec=quote('test / "ok!"'), url=test_url)
        )
        assert res.status_code == 302
        assert res.location.endswith('/temp/test--ok/record/mp_/{0}'.format(test_url))
        res = res.follow()

        res.charset = 'utf-8'

        assert '"mood": "bar"' in res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Special char test', 'url': test_url, 'ts': '2016010203000000'}
        res = self.testapp.post(
            '/api/v1/recordings/{rec}/pages?user={user}&coll=temp'.format(rec='test--ok', user=self.anon_user),
            params=page
        )

        assert res.json == {}

        user = self.anon_user

        all_recs = ['my-recording', 'my-recording-2', 'my-rec2', 'вэбрекордэр',
                    'test--ok']

        self._assert_rec_keys(user, 'temp', all_recs)

        warc_key = 'r:{user}:{coll}:{rec}:warc'.format(user=user, coll='temp', rec='test--ok')
        assert self.redis.hlen(warc_key) == 1

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
        res = self._get_anon('/temp/my-rec2/replay/http://httpbin.org/get?food=bar')
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
        assert len(cdx) == 10

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

    def test_rename_rec(self):
        res = self.testapp.post('/api/v1/recordings/my-rec2/rename/My%20Recording?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'title': 'My Recording 3', 'rec_id': 'my-recording-3', 'coll_id': 'temp'}

        all_recs = ['my-recording', 'my-recording-2', 'вэбрекордэр', 'my-recording-3', 'test--ok']

        # ensure keys up-to-date
        self._assert_rec_keys(self.anon_user, 'temp', all_recs)

        # rec replay
        res = self._get_anon('/temp/my-recording-3/replay/mp_/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        # update dyn stats
        self._add_dyn_stat(self.anon_user, 'temp', 'my-recording-3', 'http://httpbin.org/get?bood=far')
        self._assert_rec_keys(self.anon_user, 'temp', all_recs)

        # coll replay
        res = self._get_anon('/temp/mp_/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        # update dyn stats
        self._add_dyn_stat(self.anon_user, 'temp', '<all>', 'http://httpbin.org/get?bood=far')
        self._assert_rec_keys(self.anon_user, 'temp', all_recs)


    def test_anon_delete_recs(self):
        res = self.testapp.get('/api/v1/collections/temp?user={user}'.format(user=self.anon_user))
        recs = res.json['collection']['recordings']
        assert set([rec['id'] for rec in recs]) == set(['my-recording', 'my-recording-2', 'my-recording-3', 'вэбрекордэр', 'test--ok'])

        res = self.testapp.delete('/api/v1/recordings/my-recording?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'my-recording'}

        res = self.testapp.delete('/api/v1/recordings/{rec}?user={user}&coll=temp'.format(rec=quote('вэбрекордэр'), user=self.anon_user))

        assert res.json == {'deleted_id': 'вэбрекордэр'}

        res = self.testapp.delete('/api/v1/recordings/my-recording-2?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'my-recording-2'}

        res = self.testapp.delete('/api/v1/recordings/test--ok?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'test--ok'}

        user = self.anon_user

        res = self.testapp.get('/api/v1/collections/temp?user={user}'.format(user=self.anon_user))
        recs = res.json['collection']['recordings']
        assert set([rec['id'] for rec in recs]) == set(['my-recording-3'])

        self._assert_size_all_eq(user, 'temp', 'my-recording-3')

        warc_key = 'r:{user}:{coll}:{rec}:warc'.format(user=user, coll='temp', rec='my-recording-3')
        assert self.redis.hlen(warc_key) == 1

        def assert_one_warc():
            anon_dir = os.path.join(self.warcs_dir, user)
            assert len(os.listdir(anon_dir)) == 1

        self.sleep_try(0.1, 10.0, assert_one_warc)

        self.dyn_stats = [stat for stat in self.dyn_stats
                           if ('my-recording:' not in stat and
                               'вэбрекордэр:' not in stat)]

        self._assert_rec_keys(user, 'temp', ['my-recording-3'])

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
        res = self.testapp.get('/_new/temp/patch/patch/http://example.com/?patch=test')
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
        res = self._get_anon('/temp/my-rec/replay/mp_/http://example.com/', status=404)
        assert res.status_code == 404

    def test_error_anon_not_found_coll_url(self):
        res = self._get_anon('/temp/mp_/http://example.com/', status=404)
        assert res.status_code == 404

    def test_anon_rec_name_redir(self):
        res = self._get_anon('/temp/mp_/example.com', status=307)
        assert res.status_code == 307
        print(res.headers['Location'])
        assert res.headers['Location'].endswith('/' + self.anon_user + '/temp/mp_/http://example.com/')

    def test_error_anon_not_found_recording_url(self):
        res = self._get_anon('/temp/my-recording/replay/mp_/http://example.com/', status=404)
        assert res.status_code == 404

    def test_error_anon_invalid_coll(self):
        res = self._get_anon('/temp2/my-recording/record/mp_/http://httpbin.org/get?food=bar', status=404)
        assert res.status_code == 404

    def test_anon_auto_delete(self):
        sesh_redis = FakeStrictRedis.from_url('redis://localhost:6379/0')
        sesh_redis.flushdb()

        def assert_empty_keys():
            assert set(self.redis.keys()) == set(['h:roles', 'h:defaults', 'h:temp-usage'])
            assert glob.glob(os.path.join(self.warcs_dir, 'temp$*')) == []

        self.sleep_try(0.1, 10.0, assert_empty_keys)

