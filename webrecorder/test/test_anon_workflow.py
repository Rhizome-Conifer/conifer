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

from webrecorder.models.user import User
from webrecorder.models.stats import Stats

from webrecorder.session import Session


# ============================================================================
class TestTempContent(FullStackTests):
    REDIS_KEYS = [
        'r:{rec}:cdxj',
        'r:{rec}:open',
        'r:{rec}:info',
        'r:{rec}:wk',
        'r:{rec}:_ps',
        'r:{rec}:_pc',
        'c:{coll}:warc',
        'c:{coll}:p',
        'c:{coll}:info',
        'c:{coll}:recs',
        'u:{user}:info',
        'u:{user}:colls',
        'h:defaults',
        'h:roles',
        Stats.ALL_CAPTURE_TEMP_KEY,
    ]

    POST_DEL_KEYS = [
        'h:defaults',
        'h:roles',
        Stats.ALL_CAPTURE_TEMP_KEY,
        Stats.REPLAY_TEMP_KEY,
        Stats.DELETE_TEMP_KEY,
        Stats.DOWNLOADS_TEMP_SIZE_KEY,
        Stats.DOWNLOADS_TEMP_COUNT_KEY,
     ]

    PAGE_STATS = {'rec': 'r:{rec}:<sesh_id>:stats:{url}',
                  'coll': 'c:{coll}:<sesh_id>:stats:{url}'
                 }


    @classmethod
    def setup_class(cls, **kwargs):
        super(TestTempContent, cls).setup_class(storage_worker=True,
                                                temp_worker=True)

        def make_id(self):
            sesh_id = 'sesh_id'
            redis_key = self.key_template.format(sesh_id)

            return sesh_id, redis_key

        cls.seshmock = patch('webrecorder.session.RedisSessionMiddleware.make_id', make_id)
        cls.seshmock.start()

        #cls.manager = init_manager_for_cli()

        cls.dyn_stats = []
        cls.downloaded = False
        cls.deleted = False

        cls.temp_coll = None

        cls.pages = []

    @classmethod
    def teardown_class(cls, *args, **kwargs):
        cls.seshmock.stop()

        super(TestTempContent, cls).teardown_class(*args, **kwargs)

    @classmethod
    def set_downloaded(cls):
        cls.downloaded = True

    @classmethod
    def set_deleted(cls):
        cls.deleted = True

    def _get_redis_keys(self, keylist, user, coll, rec):
        keylist = [key.format(user=user, coll=coll, rec=rec) for key in keylist]
        return keylist

    @classmethod
    def _init_temp_coll(cls):
        cls.temp_coll = cls.redis.hget('u:{user}:colls'.format(user=cls.anon_user), 'temp')

    @classmethod
    def _add_page(cls, page_id):
        cls.pages.append(page_id)

    def _assert_rec_keys(self, user, coll_name, rec_list, url='', replay_coll=True, del_q=False,
                         check_stats=False):
        exp_keys = []

        coll = self.temp_coll
        actual_rec_list = 'c:{coll}:recs'.format(coll=coll)

        for rec in rec_list:
            #rec = self.redis.hget(rec_map, rec_name)
            #rec = rec_name
            assert self.redis.sismember(actual_rec_list, rec)
            exp_keys.extend(self._get_redis_keys(self.REDIS_KEYS, user, coll, rec))

        if replay_coll:
            exp_keys.append('c:{coll}:cdxj'.format(user=user, coll=coll))
            exp_keys.append(Stats.REPLAY_TEMP_KEY)

        if self.downloaded:
            exp_keys.append(Stats.DOWNLOADS_TEMP_COUNT_KEY)
            exp_keys.append(Stats.DOWNLOADS_TEMP_SIZE_KEY)

        if self.deleted:
            exp_keys.append(Stats.DELETE_TEMP_KEY)

        if check_stats:
            self._check_dyn_stats(exp_keys)

        if url:
            self._add_dyn_stat(user, coll, rec, url)
        exp_keys.extend(self.dyn_stats)

        res_keys = self.redis.keys()

        assert set(exp_keys) == set(res_keys)

    def _add_dyn_stat(self, user, coll, rec, url):
        if not rec or rec == '*' or rec == '0':
            stats = self.PAGE_STATS['coll']
        else:
            stats = self.PAGE_STATS['rec']

        self.dyn_stats.append(stats.format(coll=coll,
                                           rec=rec, url=url))

    def _check_dyn_stats(self, exp_keys):
        new_stats = []
        for stat in self.dyn_stats:
            prefix = ':'.join(stat.split(':', 2)[0:2])
            if any(key.startswith(prefix) for key in exp_keys):
                new_stats.append(stat)

        self.dyn_stats = new_stats

    def _assert_size_all_eq(self, user, coll_name, rec):
        coll = self.temp_coll
        #actual_rec_list = 'c:{coll}:recs'.format(coll=self.temp_coll)
        #rec = self.redis.hget(rec_map, rec_name) or '0'

        r_info = 'r:{rec}:info'.format(user=user, coll=coll, rec=rec)
        c_info = 'c:{coll}:info'.format(user=user, coll=coll)
        u_info = 'u:{user}:info'.format(user=user)

        size = self.redis.hget(r_info, 'size')
        assert size is not None
        assert size == self.redis.hget(c_info, 'size')
        assert size == self.redis.hget(u_info, 'size')

        assert self.redis.hget(r_info, 'updated_at') is not None

    def _get_warc_key_len(self, user, coll, rec):
        coll, rec = self.get_coll_rec(user, coll, rec)
        warc_key = 'r:{rec}:wk'.format(rec=rec)
        #warc_key = 'c:{coll}:warc'.format(coll=coll)
        #return self.redis.hlen(warc_key)
        return self.redis.scard(warc_key)

    def _get_anon(self, url, status=None):
        return self.testapp.get('/' + self.anon_user + url, status=status)

    def test_rec_top_frame(self):
        self.set_uuids('Recording', ['my-recording'])

        res = self.testapp.get('/_new/temp/my-recording/record/http://httpbin.org/get?food=bar')
        assert res.status_code == 302
        assert res.location.endswith('/temp/my-recording/record/http://httpbin.org/get?food=bar')
        res = res.follow()

        res.charset = 'utf-8'
        assert '"http://httpbin.org/get?food=bar"' in res.text
        assert '<iframe' in res.text

    def test_anon_record_1(self):
        res = self._get_anon('/temp/my-recording/record/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        self._init_temp_coll()

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'ts': '2016010203000000'}
        res = self.testapp.post_json('/api/v1/recording/my-recording/pages?user={user}&coll=temp'.format(user=self.anon_user), params=page)

        self._add_page(res.json['page_id'])

        user = self.anon_user

        self._assert_rec_keys(user, 'temp', ['my-recording'], replay_coll=False)

        self._assert_size_all_eq(user, 'temp', 'my-recording')

        #warc_key = 'r:{user}:{coll}:{rec}:warc'.format(user=user, coll='temp', rec='my-recording')
        #assert self.redis.hlen(warc_key) == 1

    def test_anon_replay_1(self):
        res = self._get_anon('/temp/my-recording/replay/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        self._assert_rec_keys(self.anon_user, 'temp', ['my-recording'], 'http://httpbin.org/get?food=bar', replay_coll=False)
        assert '"food": "bar"' in res.text, res.text

    def test_anon_replay_coll_1(self):
        res = self._get_anon('/temp/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        coll, rec = self.get_coll_rec(self.anon_user, 'temp', None)
        self._add_dyn_stat(self.anon_user, coll, rec, 'http://httpbin.org/get?food=bar')

        self._assert_rec_keys(self.anon_user, 'temp', ['my-recording'])
        assert '"food": "bar"' in res.text, res.text

        assert int(self.redis.ttl('c:{coll}:cdxj'.format(coll=coll)) > 0)

    def test_anon_record_sanitize_redir(self):
        self.set_uuids('Recording', ['my-rec2'])

        res = self.testapp.get('/_new/temp/My%20Rec2/record/http://httpbin.org/get?bood=far')

        res.charset = 'utf-8'

        assert self.testapp.cookies['__test_sesh'] != ''
        assert res.headers['Location'].endswith('/temp/my-rec2/record/http://httpbin.org/get?bood=far')

        res = self.testapp.get('/api/v1/recording/my-rec2?user={user}&coll=temp'.format(user=self.anon_user))
        assert res.json['recording']['id'] == 'my-rec2'
        assert res.json['recording']['title'] == 'My Rec2'

    def test_anon_record_top_frame(self):
        res = self._get_anon('/temp/my-rec2/record/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"record"' in res.text
        assert '"my-rec2"' in res.text, res.text
        assert '"temp"' in res.text
        assert '"Temporary Collection"' in res.text

    def test_anon_record_2(self):
        res = self._get_anon('/temp/my-rec2/record/mp_/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?bood=far', 'ts': '2016010203000000'}
        res = self.testapp.post_json('/api/v1/recording/my-rec2/pages?user={user}&coll=temp'.format(user=self.anon_user), params=page)

        self._add_page(res.json['page_id'])

        user = self.anon_user

        self._assert_rec_keys(user, 'temp', ['my-recording', 'my-rec2'])

        anon_dir = os.path.join(self.warcs_dir, user)
        assert len(os.listdir(anon_dir)) == 2

        assert self._get_warc_key_len(user, 'temp', 'my-rec2') == 1

    def test_anon_record_3(self):
        self.set_uuids('Recording', ['my-recording-2'])
        res = self.testapp.get('/$record/temp/my-recording/mp_/http://httpbin.org/get?good=far')
        assert res.status_code == 302
        assert res.location.endswith('/temp/my-recording-2/record/mp_/http://httpbin.org/get?good=far')
        res = res.follow()

        res.charset = 'utf-8'

        assert '"good": "far"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?good=far', 'ts': '2016010203000000'}
        res = self.testapp.post_json('/api/v1/recording/my-recording-2/pages?user={user}&coll=temp'.format(user=self.anon_user), params=page)

        self._add_page(res.json['page_id'])

        user = self.anon_user

        self._assert_rec_keys(user, 'temp', ['my-recording', 'my-rec2', 'my-recording-2'])

        assert self._get_warc_key_len(user, 'temp', 'my-recording-2') == 1

    def test_anon_unicode_record_1(self):
        self.set_uuids('Recording', ['unicode-title-test'])

        test_url = 'http://httpbin.org/get?bood=far'
        res = self.testapp.get(
            '/_new/temp/{rec}/record/mp_/{url}'.format(rec=quote('вэбрекордэр'), url=test_url)
        )
        # follow() breaks due to unicode encoding
        # res = res.follow()
        res = self.testapp.get(res.headers['Location'])
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'вэбрекордэр!', 'url': test_url, 'ts': '2016010203000000'}
        res = self.testapp.post_json(
            '/api/v1/recording/{rec}/pages?user={user}&coll=temp'.format(rec='unicode-title-test', user=self.anon_user),
            params=page
        )

        self._add_page(res.json['page_id'])

        user = self.anon_user

        all_recs = ['my-recording', 'my-recording-2', 'my-rec2', 'unicode-title-test']

        self._assert_rec_keys(user, 'temp', all_recs)

        anon_dir = os.path.join(self.warcs_dir, user)
        assert len(os.listdir(anon_dir)) == len(all_recs)

        assert self._get_warc_key_len(user, 'temp', 'unicode-title-test') == 1

        # test non-protocol url replay routing
        res = self._get_anon(
            '/temp/{rec}/{url}'.format(rec=quote('unicode-title-test'), url=sub(r'^http://', '', test_url))
        )
        res.charset = 'utf-8'

        # accessing the url should route to the replay
        assert res.status_code == 200
        assert '<iframe' in res.text

    def test_anon_special_characters_record(self):
        self.set_uuids('Recording', ['test--ok'])

        test_url = 'http://httpbin.org/get?mood=bar'
        res = self.testapp.get(
            '/_new/temp/{rec}/record/mp_/{url}'.format(rec=quote('test "ok!"'), url=test_url)
        )
        assert res.status_code == 302
        assert res.location.endswith('/temp/test--ok/record/mp_/{0}'.format(test_url))
        res = res.follow()

        res.charset = 'utf-8'

        assert '"mood": "bar"' in res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Special char test', 'url': test_url, 'ts': '2016010203000000'}
        res = self.testapp.post_json(
            '/api/v1/recording/{rec}/pages?user={user}&coll=temp'.format(rec='test--ok', user=self.anon_user),
            params=page
        )

        self._add_page(res.json['page_id'])

        user = self.anon_user

        all_recs = ['my-recording', 'my-recording-2', 'my-rec2', 'unicode-title-test',
                    'test--ok']

        self._assert_rec_keys(user, 'temp', all_recs)

        assert self._get_warc_key_len(user, 'temp', 'test--ok') == 1

    def test_anon_html_format_record(self):
        self.set_uuids('Recording', ['emmyem-test-recording'])

        test_url = 'http://httpbin.org/get?boof=mar'
        res = self.testapp.get(
            '/_new/temp/{rec}/record/mp_/{url}'.format(rec=quote('<em>My<em> test recording'), url=test_url)
        )
        assert res.status_code == 302
        assert res.location.endswith('/temp/emmyem-test-recording/record/mp_/{0}'.format(test_url))
        res = res.follow()

        res.charset = 'utf-8'

        assert '"boof": "mar"' in res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'HTML formatting test', 'url': test_url, 'ts': '2016010203000000'}
        res = self.testapp.post_json(
            '/api/v1/recording/{rec}/pages?user={user}&coll=temp'.format(rec='emmyem-test-recording', user=self.anon_user),
            params=page
        )

        self._add_page(res.json['page_id'])

        user = self.anon_user

        all_recs = ['my-recording', 'my-recording-2', 'my-rec2', 'unicode-title-test',
                    'test--ok', 'emmyem-test-recording']

        self._assert_rec_keys(user, 'temp', all_recs)

        coll, rec = self.get_coll_rec(user, 'temp', 'emmyem-test-recording')
        #info = self.manager.get_content_inject_info(self.anon_user, coll, 'temp', rec, 'emmyem-test-recording')
        #assert info['rec_id'] == 'emmyem-test-recording'
        #assert info['rec_title'] == '%3Cem%3EMy%3C/em%3E test recording'

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

        assert 'http://httpbin.org/get?food=bar' in res.text, res.text
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
        assert '"my-rec2"' in res.text
        assert '"temp"' in res.text
        assert '"Temporary Collection"' in res.text

    def test_anon_replay_coll_top_frame(self):
        res = self._get_anon('/temp/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"replay-coll"' in res.text
        assert '"rec_id"' not in res.text
        assert '"rec_title"' not in res.text
        assert '"temp"' in res.text
        assert '"Temporary Collection"' in res.text

    def test_anon_download_rec(self):
        res = self._get_anon('/temp/my-rec2/$download')

        self.set_downloaded()

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
        assert len(cdx) == 12

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

        # request
        cdx[4]['url'] = 'http://httpbin.org/get?boof=mar'
        cdx[4]['mime'] = '-'

    def _test_rename_rec(self):
        res = self.testapp.post_json('/api/v1/recording/my-rec2/rename/My%20Recording?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'rec_id': 'my-recording-3', 'coll_id': 'temp'}

        all_recs = ['my-recording', 'my-recording-2', 'unicode-title-test', 'my-recording-3', 'test--ok', 'emmyem-test-recording']

        # ensure keys up-to-date
        self._assert_rec_keys(self.anon_user, 'temp', all_recs)

        # rec replay
        res = self._get_anon('/temp/my-recording-3/replay/mp_/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        coll, rec = self.get_coll_rec(self.anon_user, 'temp', 'my-recording-3')

        # update dyn stats
        self._add_dyn_stat(self.anon_user, coll, rec, 'http://httpbin.org/get?bood=far')
        self._assert_rec_keys(self.anon_user, 'temp', all_recs)

        # coll replay
        res = self._get_anon('/temp/mp_/http://httpbin.org/get?bood=far')
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        # update dyn stats
        self._add_dyn_stat(self.anon_user, coll, '', 'http://httpbin.org/get?bood=far')
        self._assert_rec_keys(self.anon_user, 'temp', all_recs)


    def test_anon_coll_info(self):
        res = self.testapp.get('/api/v1/collection/temp?user={user}'.format(user=self.anon_user))
        recs = res.json['collection']['recordings']
        assert set([rec['id'] for rec in recs]) == set(['my-recording', 'my-recording-2', 'my-rec2', 'unicode-title-test', 'test--ok', 'emmyem-test-recording'])

        assert res.json['collection']['timespan'] >= 0
        assert res.json['collection']['duration'] >= 0

    def test_anon_delete_recs(self):
        res = self.testapp.delete('/api/v1/recording/my-recording?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'my-recording'}

        res = self.testapp.delete('/api/v1/recording/{rec}?user={user}&coll=temp'.format(rec='unicode-title-test', user=self.anon_user))

        assert res.json == {'deleted_id': 'unicode-title-test'}

        res = self.testapp.delete('/api/v1/recording/my-recording-2?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'my-recording-2'}

        res = self.testapp.delete('/api/v1/recording/test--ok?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'test--ok'}

        res = self.testapp.delete('/api/v1/recording/emmyem-test-recording?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'emmyem-test-recording'}

        user = self.anon_user

        self.set_deleted()

        res = self.testapp.get('/api/v1/collection/temp?user={user}'.format(user=self.anon_user))
        recs = res.json['collection']['recordings']
        assert set([rec['id'] for rec in recs]) == set(['my-rec2'])

        self._assert_size_all_eq(user, 'temp', 'my-rec2')

        assert self._get_warc_key_len(user, 'temp', 'my-rec2') == 1

        def assert_one_warc():
            anon_dir = os.path.join(self.warcs_dir, user)
            assert len(os.listdir(anon_dir)) == 1

        self.sleep_try(0.1, 10.0, assert_one_warc)

        self._assert_rec_keys(user, 'temp', ['my-rec2'], del_q=True, check_stats=True)

        res = self.testapp.delete('/api/v1/recording/my-recording?user={user}&coll=temp'.format(user=self.anon_user), status=404)

        assert res.json == {'error': 'no_such_recording'}

    def test_anon_record_redirect_and_delete(self):
        self.set_uuids('Recording', ['recording-session'])
        res = self.testapp.get('/record/mp_/http://example.com/')
        assert res.status_code == 302

        parts = urlsplit(res.headers['Location'])

        path_parts = parts.path.split('/', 2)
        assert self.anon_user == path_parts[1]

        assert self.anon_user.startswith(Session.TEMP_PREFIX)
        assert parts.path.endswith('/temp/recording-session/record/mp_/http://example.com/')

        # Delete this recording
        res = self.testapp.delete('/api/v1/recording/recording-session?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'recording-session'}


        assert int(self.redis.hget(User.INFO_KEY.format(user=self.anon_user), Stats.DELETE_PROP)) > 0

    def test_anon_patch_redirect_and_delete(self):
        self.set_uuids('Recording', ['patch'])
        res = self.testapp.get('/_new/temp/patch/patch/http://example.com/?patch=test')
        assert res.status_code == 302

        parts = urlsplit(res.headers['Location'])
        path_parts = parts.path.split('/', 2)
        assert self.anon_user == path_parts[1]

        assert self.anon_user.startswith(Session.TEMP_PREFIX)

        assert res.headers['Location'].endswith('/temp/patch/patch/http://example.com/?patch=test')

        # Delete this recording
        res = self.testapp.delete('/api/v1/recording/patch?user={user}&coll=temp'.format(user=self.anon_user))

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
            assert set(self.redis.keys()) == set(self.POST_DEL_KEYS)
            assert glob.glob(os.path.join(self.warcs_dir, 'temp$*')) == []

        self.sleep_try(0.1, 10.0, assert_empty_keys)

        def assert_dir_delete():
            assert not os.path.isdir(os.path.join(self.warcs_dir, self.anon_user))

        self.sleep_try(0.1, 5.0, assert_dir_delete)

