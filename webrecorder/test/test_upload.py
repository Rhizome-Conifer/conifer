from .testutils import FullStackTests, BaseWRTests

import os
import webtest
import json
import time

import pytest

import requests
from contextlib import contextmanager

from webrecorder.models.stats import Stats
from webrecorder.models.user import User
from webrecorder.models.base import RedisUniqueComponent
from webrecorder.utils import today_str

from webrecorder.models.usermanager import CLIUserManager
from warcio import ArchiveIterator

from webrecorder.standalone.webrecorder_player import webrecorder_player

from webrecorder.standalone.serializefakeredis import FakeRedisSerializer, DATABASES

from mock import patch


# ============================================================================
class TestUpload(FullStackTests):
    ID_1 = '1884e17293'
    ID_2 = 'eed99fa580'
    ID_3 = 'fc17891a4a'

    timestamps = dict(created_at={},
                      updated_at={},
                      recorded_at={}
                     )

    @classmethod
    def setup_class(cls, **kwargs):
        super(TestUpload, cls).setup_class(temp_worker=False)

        cls.manager = CLIUserManager()

        cls.warc = None

        cls.test_upload_warc = os.path.join(cls.get_curr_dir(), 'warcs', 'test_3_15_upload.warc.gz')

    @classmethod
    def test_upload_anon(self):
        with open(self.test_upload_warc, 'rb') as fh:
            res = self.testapp.put('/_upload?filename=example2.warc.gz', params=fh.read(), status=400)

        assert res.json == {'error': 'not_logged_in'}

    def test_create_user_def_coll(self):
        self.manager.create_user('test@example.com', 'test', 'TestTest123', 'archivist', 'Test')

    def test_login(self):
        params = {'username': 'test',
                  'password': 'TestTest123',
                 }

        res = self.testapp.post_json('/api/v1/auth/login', params=params)

        assert res.json['user']['anon'] == False
        assert res.json['user']['num_collections'] == 1
        assert res.json['user']['role'] == 'archivist'
        assert res.json['user']['username'] == 'test'

        assert self.testapp.cookies.get('__test_sesh', '') != ''

    def test_default_coll(self):
        res = self.testapp.get('/test/default-collection')
        res.charset = 'utf-8'
        assert '"test"' in res.text

    def test_logged_in_record_1(self):
        self.set_uuids('Recording', ['rec-sesh'])
        res = self.testapp.get('/_new/default-collection/rec-sesh/record/mp_/http://httpbin.org/get?food=bar')
        assert res.headers['Location'].endswith('/test/default-collection/rec-sesh/record/mp_/http://httpbin.org/get?food=bar')
        res = res.follow()
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title', 'url': 'http://httpbin.org/get?food=bar', 'timestamp': '2016010203000000'}
        res = self.testapp.post_json('/api/v1/recording/rec-sesh/pages?user=test&coll=default-collection', params=page)

        assert res.json['page_id']
        page_id = res.json['page_id']

        # Add list
        params = {'title': 'New List',
                  'desc': 'List Description Goes Here!'
                 }

        res = self.testapp.post_json('/api/v1/lists?user=test&coll=default-collection', params=params)

        blist = res.json['list']
        list_id = blist['id']

        # Add bookmark
        page['page_id'] = page_id
        res = self.testapp.post_json('/api/v1/list/%s/bookmarks?user=test&coll=default-collection' % list_id, params=page)

        bookmark = res.json['bookmark']

    def test_logged_in_record_2(self):
        self.set_uuids('Recording', ['another-sesh'])
        res = self.testapp.get('/_new/default-collection/another-sesh/record/mp_/http://httpbin.org/get?bood=far')
        assert res.headers['Location'].endswith('/test/default-collection/another-sesh/record/mp_/http://httpbin.org/get?bood=far')
        res = res.follow()
        res.charset = 'utf-8'

        assert '"bood": "far"' in res.text, res.text

        assert self.testapp.cookies['__test_sesh'] != ''

        # Add as page
        page = {'title': 'Example Title 2', 'url': 'http://httpbin.org/get?bood=far', 'timestamp': '2016010203000000'}
        res = self.testapp.post_json('/api/v1/recording/another-sesh/pages?user=test&coll=default-collection', params=page)

        assert res.json['page_id']
        page_id = res.json['page_id']

        # Add list
        params = {'title': 'New List 2',
                  'desc': 'Another List'
                 }

        res = self.testapp.post_json('/api/v1/lists?user=test&coll=default-collection', params=params)

        blist = res.json['list']
        list_id = blist['id']

        # Add bookmark
        page['page_id'] = page_id
        res = self.testapp.post_json('/api/v1/list/%s/bookmarks?user=test&coll=default-collection' % list_id, params=page)

        bookmark = res.json['bookmark']

    def test_toggle_public_index(self):
        params = {'public_index': True}

        res = self.testapp.post_json('/api/v1/collection/default-collection?user=test', params=params)

        assert res.json['collection']['public_index'] == True

    def test_logged_in_download_coll(self):
        res = self.testapp.get('/test/default-collection/$download')

        assert res.headers['Content-Disposition'].startswith("attachment; filename*=UTF-8''default-collection-")

        TestUpload.warc = self._get_dechunked(res.body)

    def test_read_warcinfo(self):
        self.warc.seek(0)
        metadata = []

        for record in ArchiveIterator(self.warc):
            if record.rec_type == 'warcinfo':
                stream = record.content_stream()
                warcinfo = {}

                while True:
                    line = stream.readline().decode('utf-8')
                    if not line:
                        break

                    parts = line.split(': ', 1)
                    warcinfo[parts[0].strip()] = parts[1].strip()

                assert set(warcinfo.keys()) == {'software', 'format', 'creator', 'isPartOf', 'json-metadata'}
                assert warcinfo['software'].startswith('Webrecorder Platform ')
                assert warcinfo['format'] == 'WARC File Format 1.0'
                assert warcinfo['creator'] == 'test'
                assert warcinfo['isPartOf'] in ('default-collection', 'default-collection/rec-sesh', 'default-collection/another-sesh')

                metadata.append(json.loads(warcinfo['json-metadata']))

        assert len(metadata) == 3
        assert metadata[0]['type'] == 'collection'
        assert set(metadata[0].keys()) == {'created_at', 'updated_at',
                                           'title', 'desc', 'type', 'size',
                                           'lists', 'public', 'public_index'}

        assert metadata[0]['title'] == 'Default Collection'
        assert 'This is your first' in metadata[0]['desc']

        assert metadata[1]['type'] == 'recording'
        assert set(metadata[1].keys()) == {'created_at', 'updated_at', 'recorded_at',
                                           'title', 'desc', 'type', 'size',
                                           'pages'}

        assert metadata[0]['created_at'] <= metadata[0]['updated_at']

        for metadata_item in metadata:
            for field in TestUpload.timestamps.keys():
                if field == 'recorded_at' and metadata_item['type'] == 'collection':
                    continue

                TestUpload.timestamps[field][metadata_item['title']] = RedisUniqueComponent.to_iso_date(metadata_item[field])

        assert set(TestUpload.timestamps['created_at'].keys()) == {'rec-sesh', 'another-sesh', 'Default Collection'}

    def test_upload_error_out_of_space(self):
        max_size = self.redis.hget('u:test:info', 'max_size')
        self.redis.hset('u:test:info', 'max_size', '5')

        res = self.testapp.put('/_upload?filename=example.warc.gz', params=self.warc.getvalue(), status=400)

        assert res.json == {'error': 'out_of_space'}
        self.redis.hset('u:test:info', 'max_size', max_size)

    def test_logged_in_upload_coll(self):
        time.sleep(1.0)

        res = self.testapp.put('/_upload?filename=example.warc.gz', params=self.warc.getvalue())
        res.charset = 'utf-8'
        assert res.json['user'] == 'test'
        assert res.json['upload_id'] != ''

        upload_id = res.json['upload_id']

        res = self.testapp.get('/_upload/' + upload_id + '?user=test')

        assert res.json['coll'] == 'default-collection-2'
        assert res.json['coll_title'] == 'Default Collection'
        assert res.json['filename'] == 'example.warc.gz'
        assert res.json['files'] == 1
        assert res.json['total_size'] >= 3000
        assert res.json['done'] == False

        def assert_finished():
            res = self.testapp.get('/_upload/' + upload_id + '?user=test')
            assert res.json['done'] == True
            assert res.json['size'] >= res.json['total_size']

        self.sleep_try(0.2, 10.0, assert_finished)

    def test_logged_in_replay(self):
        res = self.testapp.get('/test/default-collection-2/mp_/http://httpbin.org/get?food=bar')
        res.charset = 'utf-8'

        assert '"food": "bar"' in res.text, res.text

    def test_uploaded_coll_info(self):
        res = self.testapp.get('/api/v1/collection/default-collection-2?user=test')

        assert res.json['collection']
        collection = res.json['collection']

        assert 'This is your first collection' in collection['desc']
        assert collection['id'] == 'default-collection-2'
        assert collection['title'] == 'Default Collection'
        assert collection['slug'] == 'default-collection-2'
        assert collection['public_index'] == True
        assert collection['public'] == False
        assert len(collection['pages']) == 2

        for field in TestUpload.timestamps.keys():
            if field == 'recorded_at':
                continue

            assert TestUpload.timestamps[field][collection['title']] == collection[field], (field, collection.get('title'))

        for recording in collection['recordings']:
            for field in TestUpload.timestamps.keys():
                assert TestUpload.timestamps[field][recording['title']] == recording[field], (field, recording.get('title'))

        assert len(collection['lists']) == 2
        assert collection['lists'][0]['desc'] == 'List Description Goes Here!'
        assert collection['lists'][0]['title'] == 'New List'
        assert collection['lists'][0]['slug'] == 'new-list'

        assert collection['lists'][1]['desc'] == 'Another List'
        assert collection['lists'][1]['title'] == 'New List 2'
        assert collection['lists'][1]['slug'] == 'new-list-2'

        # Pages
        assert len(collection['pages']) == 2
        assert len(collection['recordings']) == 2

        # ensure each page maps to a recording
        assert (set([page['rec'] for page in collection['pages']]) ==
                set([recording['id'] for recording in collection['recordings']]))

        # First List
        assert len(collection['lists'][0]['bookmarks']) == 1
        bookmark = collection['lists'][0]['bookmarks'][0]

        assert bookmark['timestamp'] == '2016010203000000'
        assert bookmark['url'] == 'http://httpbin.org/get?food=bar'
        assert bookmark['title'] == 'Example Title'

        assert bookmark['page_id'] in [page['id'] for page in collection['pages']]

        # Second List
        assert len(collection['lists'][1]['bookmarks']) == 1
        bookmark = collection['lists'][1]['bookmarks'][0]

        assert bookmark['timestamp'] == '2016010203000000'
        assert bookmark['url'] == 'http://httpbin.org/get?bood=far'
        assert bookmark['title'] == 'Example Title 2'

        assert bookmark['page_id'] in [page['id'] for page in collection['pages']]

    def test_upload_3_x_warc(self):
        self.set_uuids('Recording', ['uploaded-rec'])
        with open(self.test_upload_warc, 'rb') as fh:
            res = self.testapp.put('/_upload?filename=example2.warc.gz', params=fh.read())

        res.charset = 'utf-8'
        assert res.json['user'] == 'test'
        assert res.json['upload_id'] != ''

        upload_id = res.json['upload_id']
        res = self.testapp.get('/_upload/' + upload_id + '?user=test')

        assert res.json['coll'] == 'temporary-collection'
        assert res.json['coll_title'] == 'Temporary Collection'
        assert res.json['filename'] == 'example2.warc.gz'
        assert res.json['files'] == 1
        assert res.json['total_size'] == 5192
        assert res.json['done'] == False

        def assert_finished():
            res = self.testapp.get('/_upload/' + upload_id + '?user=test')
            assert res.json['done'] == True
            assert res.json['size'] >= res.json['total_size']

        self.sleep_try(0.2, 10.0, assert_finished)

    def test_replay_2(self):
        res = self.testapp.get('/test/temporary-collection/mp_/http://example.com/')
        res.charset = 'utf-8'

        assert 'Example Domain' in res.text, res.text

    def test_uploaded_coll_info_2(self):
        res = self.testapp.get('/api/v1/collection/temporary-collection?user=test')

        assert res.json['collection']
        collection = res.json['collection']

        assert collection['desc'] == ''
        assert collection['id'] == 'temporary-collection'
        assert collection['slug'] == 'temporary-collection'
        assert collection['title'] == 'Temporary Collection'

        assert collection['pages'] == [{'id': self.ID_1,
                                        'rec': 'uploaded-rec',
                                        'timestamp': '20180306181354',
                                        'title': 'Example Domain',
                                        'url': 'http://example.com/'}]

    def test_upload_force_coll(self):
        self.set_uuids('Recording', ['upload-rec-2'])
        with open(self.test_upload_warc, 'rb') as fh:
            res = self.testapp.put('/_upload?filename=example2.warc.gz&force-coll=default-collection', params=fh.read())

        res.charset = 'utf-8'
        assert res.json['user'] == 'test'
        assert res.json['upload_id'] != ''

        upload_id = res.json['upload_id']
        res = self.testapp.get('/_upload/' + upload_id + '?user=test')

        assert res.json['coll'] == 'default-collection'
        assert res.json['coll_title'] == 'Default Collection'
        assert res.json['filename'] == 'example2.warc.gz'
        assert res.json['files'] == 1
        assert res.json['total_size'] >= 3000
        assert res.json['done'] == False

        def assert_finished():
            res = self.testapp.get('/_upload/' + upload_id + '?user=test')
            assert res.json['done'] == True
            assert res.json['size'] >= res.json['total_size']

        self.sleep_try(0.2, 10.0, assert_finished)

    def test_coll_info_replay_3(self):
        res = self.testapp.get('/api/v1/collection/default-collection?user=test')

        assert res.json['collection']
        collection = res.json['collection']

        assert collection['id'] == 'default-collection'
        assert 'This is your first collection' in collection['desc']
        assert collection['title'] == 'Default Collection'

        assert len(collection['pages']) == 3

        assert {'id': self.ID_2,
                'rec': 'upload-rec-2',
                'timestamp': '20180306181354',
                'title': 'Example Domain',
                'url': 'http://example.com/'} in collection['pages']

        assert {'id': self.ID_3,
                'rec': 'rec-sesh',
                'timestamp': '2016010203000000',
                'title': 'Example Title',
                'url': 'http://httpbin.org/get?food=bar'} in collection['pages']


    def test_replay_3(self):
        res = self.testapp.get('/test/default-collection/mp_/http://example.com/')
        res.charset = 'utf-8'

        assert 'Example Domain' in res.text, res.text

        res = self.testapp.get('/api/v1/collection/default-collection?user=test')
        assert len(res.json['collection']['recordings']) == 3

    def test_har_upload(self):
        self.set_uuids('Recording', ['uploaded-rec-2'])
        har_file = os.path.join(self.get_curr_dir(), 'warcs', 'example.com.har')

        with open(har_file, 'rb') as fh:
            res = self.testapp.put('/_upload?filename=example.com.har', params=fh.read())

        res.charset = 'utf-8'
        assert res.json['user'] == 'test'
        assert res.json['upload_id'] != ''

        upload_id = res.json['upload_id']
        res = self.testapp.get('/_upload/' + upload_id + '?user=test')

        assert res.json['coll'] == 'uploaded-collection'
        assert res.json['coll_title'] == 'Uploaded Collection'
        assert res.json['filename'] == 'example.com.har'
        assert res.json['files'] == 1
        #assert res.json['total_size'] == 458952
        assert res.json['done'] == False

        def assert_finished():
            res = self.testapp.get('/_upload/' + upload_id + '?user=test')
            assert res.json['done'] == True

        self.sleep_try(0.2, 10.0, assert_finished)

    def test_replay_har(self):
        res = self.testapp.get('/test/uploaded-collection/mp_/http://example.com/')
        res.charset = 'utf-8'

        assert 'Example Domain' in res.text, res.text

    def test_logout_1(self):
        res = self.testapp.post('/api/v1/auth/logout', status=200)
        assert res.json['success']
        assert self.testapp.cookies.get('__test_sesh', '') == ''

    def test_replay_error_logged_out(self):
        res = self.testapp.get('/test/default-collection/mp_/http://example.com/', status=404)

    def test_upload_anon_2(self):
        with open(self.test_upload_warc, 'rb') as fh:
            res = self.testapp.put('/_upload?filename=example2.warc.gz', params=fh.read(), status=400)

        assert res.json == {'error': 'not_logged_in'}

    def test_stats(self):
        assert self.redis.hget(Stats.DOWNLOADS_USER_COUNT_KEY, today_str()) == '1'
        assert self.redis.hget(Stats.UPLOADS_COUNT_KEY, today_str()) == '4'

        assert self.redis.hget(User.INFO_KEY.format(user='test'), Stats.UPLOADS_PROP) == '4'


# ============================================================================
class PatchedFakeRedisSerializer(FakeRedisSerializer):
    def load_db(self):
        if super(PatchedFakeRedisSerializer, self).load_db():
            # remove this on load to ensure reinit if missing or key changes
            assert 'up:127.0.0.1' in DATABASES[0]
            del DATABASES[0]['up:127.0.0.1']
            return True

        return False


# ============================================================================
class TestPlayerUpload(BaseWRTests):
    @classmethod
    def setup_class(cls):
        cls.patch_serialize = patch('webrecorder.standalone.webrecorder_player.FakeRedisSerializer', PatchedFakeRedisSerializer)
        cls.patch_serialize.start()
        super(TestPlayerUpload, cls).setup_class()


    @classmethod
    def teardown_class(cls):
        cls.patch_serialize.stop()
        super(TestPlayerUpload, cls).teardown_class()

    @pytest.fixture(params=['cache_save', 'cache_load', 'nocache'])
    def cache_dir(self, request):
        if request.param != 'nocache':
            return self.warcs_dir
        else:
            return None

    @contextmanager
    def run_player(self, filename, cache_dir=None):
        player = None
        env_backup = dict(os.environ)
        try:
            self.redis.flushall()

            cmd = ['--no-browser', '-p', '0', filename]
            if cache_dir:
                cmd.append('--cache-dir')
                cmd.append(cache_dir)

            player = webrecorder_player(cmd, embed=True)
            port = player.app_serv.port

            yield port

            if cache_dir:
                assert os.path.isfile(os.path.join(cache_dir, os.path.basename(filename) + '-cache.json.gz'))

        finally:
            if player:
                player.app_serv.stop()

            os.environ.clear()
            os.environ.update(env_backup)

    def assert_finished(self, port):
        def _assert():
            res = requests.get('http://localhost:{0}/_upload/@INIT?user=local'.format(port))
            assert res.json()['done'] == True
            assert res.json()['size'] >= res.json()['total_size']

        return _assert

    def test_player_upload(self, cache_dir):
        player_filename = os.path.join(self.warcs_dir, 'sample.warc.gz')

        with open(player_filename, 'wb') as fh:
            TestUpload.warc.seek(0)
            fh.write(TestUpload.warc.read())
            fh.flush()

        with self.run_player(player_filename, cache_dir=cache_dir) as port:
            self.sleep_try(0.5, 3.0, self.assert_finished(port))

            res = requests.get('http://localhost:{0}/api/v1/collection/collection?user=local'.format(port))
            data = res.json()

        collection = data['collection']
        assert collection['id'] == 'collection'
        assert collection['public'] == True
        assert collection['public_index'] == True
        assert collection['title'] == 'Default Collection'

        assert len(collection['pages']) == 2
        assert len(collection['lists']) == 2

    def test_player_upload_wget_warc(self, cache_dir):
        player_filename = os.path.join(self.get_curr_dir(), 'warcs', 'example.com.gz.warc')

        with self.run_player(player_filename, cache_dir=cache_dir) as port:
            self.sleep_try(0.5, 3.0, self.assert_finished(port))

            res = requests.get('http://localhost:{0}/api/v1/collection/collection?user=local'.format(port))
            data = res.json()

        collection = data['collection']
        assert collection['id'] == 'collection'
        assert collection['public'] == True
        assert collection['public_index'] == True
        assert collection['title'] == 'Web Archive Collection'

        assert 'Wget/1.19.1' in collection['desc']
        assert 'example.com.gz.warc' in collection['desc']

        assert len(collection['pages']) == 1
        assert len(collection['lists']) == 1

        blist = collection['lists'][0]
        assert blist['slug'] == 'pages-detected'

        assert len(blist['bookmarks']) == 1
        bookmark = blist['bookmarks'][0]

        assert bookmark['url'] == 'http://example.com/'
        assert bookmark['timestamp'] == '20181019224204'
        assert bookmark['title'] == 'http://example.com/'

    def test_player_temp_coll(self, cache_dir):
        player_filename = os.path.join(self.get_curr_dir(), 'warcs', 'temp-example.warc')

        with self.run_player(player_filename, cache_dir=cache_dir) as port:
            self.sleep_try(0.5, 3.0, self.assert_finished(port))

            res = requests.get('http://localhost:{0}/api/v1/collection/collection?user=local'.format(port))
            data = res.json()

            res = requests.get('http://localhost:{0}/local/collection/mp_/https://example.com/'.format(port))
            assert 'Example Domain' in res.text, res.text

            proxy = 'localhost:{0}'.format(port)
            res = requests.get('https://example.com/', proxies={'https': proxy, 'http': proxy}, verify=False)
            assert 'Example Domain' in res.text, res.text

        collection = data['collection']
        assert collection['id'] == 'collection'
        assert collection['public'] == True
        assert collection['public_index'] == True
        assert collection['title'] == 'Webrecorder Collection'

        assert 'Date Created:' in collection['desc']
        assert 'temp-example.warc' in collection['desc']

        assert len(collection['pages']) == 1
        assert collection['pages'][0]['title'] == 'Example Domain'
        assert collection['pages'][0]['url'] == 'http://example.com/'

    def test_player_upload_har(self, cache_dir):
        player_filename = os.path.join(self.get_curr_dir(), 'warcs', 'example.com.har')

        with self.run_player(player_filename, cache_dir=cache_dir) as port:
            self.sleep_try(0.5, 3.0, self.assert_finished(port))

            res = requests.get('http://localhost:{0}/api/v1/collection/collection?user=local'.format(port))
            data = res.json()

            res = requests.get('http://localhost:{0}/local/collection/mp_/https://example.com/'.format(port))
            assert 'Example Domain' in res.text, res.text

            proxy = 'localhost:{0}'.format(port)
            res = requests.get('https://example.com/', proxies={'https': proxy, 'http': proxy}, verify=False)
            assert 'Example Domain' in res.text, res.text

        collection = data['collection']
        assert collection['id'] == 'collection'
        assert collection['public'] == True
        assert collection['public_index'] == True
        assert collection['title'] == 'Web Archive Collection'

        assert 'har2warc' in collection['desc']
        assert 'example.com.har' in collection['desc']

        assert len(collection['pages']) == 1
        assert collection['pages'][0]['title'] == 'https://example.com/'
        assert collection['pages'][0]['url'] == 'https://example.com/'

        if cache_dir:
            assert os.path.isfile(os.path.join(self.warcs_dir, 'example.com.har.warc'))

