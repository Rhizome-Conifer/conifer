import time
import os

from .testutils import BaseWRTests


# ============================================================================
class TestWebRecRecAPI(BaseWRTests):
    def _anon_post(self, url, *args, **kwargs):
        return self.testapp.post(url.format(user=self.anon_user), *args, **kwargs)

    def _anon_delete(self, url, *args, **kwargs):
        return self.testapp.delete(url.format(user=self.anon_user), *args, **kwargs)

    def _anon_get(self, url, *args, **kwargs):
        return self.testapp.get(url.format(user=self.anon_user), *args, **kwargs)

    def test_create_anon_rec(self):
        res = self._anon_post('/api/v1/recordings?user={user}&coll=temp', params={'title': 'My Rec'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['recording']['id'] == 'my-rec'
        assert res.json['recording']['title'] == 'My Rec'

        assert self.redis.exists('r:' + self.anon_user + ':temp:my-rec:info')

    def test_create_anon_rec_dup(self):
        res = self._anon_post('/api/v1/recordings?user={user}&coll=temp', params={'title': 'My Rec'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['recording']['id'] == 'my-rec-2'
        assert res.json['recording']['title'] == 'My Rec 2'

        assert self.redis.exists('r:' + self.anon_user + ':temp:my-rec-2:info')



    def test_anon_get_anon_rec(self):
        res = self._anon_get('/api/v1/recordings/my-rec?user={user}&coll=temp')

        assert res.json['recording']
        rec = res.json['recording']

        assert rec['size'] == 0
        assert rec['id'] == 'my-rec'
        assert rec['title'] == 'My Rec'
        assert rec['download_url'] == 'http://localhost:80/{user}/temp/my-rec/$download'.format(user=self.anon_user)
        assert rec['created_at'] == rec['updated_at']
        assert rec['created_at'] <= int(time.time())

    def test_create_another_anon_rec(self):
        res = self._anon_post('/api/v1/recordings?user={user}&coll=temp', params={'title': '2 Another! Recording!'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['recording']['id'] == '2-another-recording'

        assert self.redis.exists('r:' + self.anon_user + ':temp:2-another-recording:info')

    def test_list_all_recordings(self):
        res = self._anon_get('/api/v1/recordings?user={user}&coll=temp')

        recs = res.json['recordings']
        assert len(recs) == 3

        recs.sort(key=lambda x: x['id'])

        assert recs[0]['id'] == '2-another-recording'
        assert recs[0]['title'] == '2 Another! Recording!'
        assert recs[0]['download_url'] == 'http://localhost:80/{user}/temp/2-another-recording/$download'.format(user=self.anon_user)

        assert recs[1]['id'] == 'my-rec'
        assert recs[1]['title'] == 'My Rec'
        assert recs[1]['download_url'] == 'http://localhost:80/{user}/temp/my-rec/$download'.format(user=self.anon_user)

        assert recs[2]['id'] == 'my-rec-2'
        assert recs[2]['title'] == 'My Rec 2'
        assert recs[2]['download_url'] == 'http://localhost:80/{user}/temp/my-rec-2/$download'.format(user=self.anon_user)

    def test_page_list_0(self):
        res = self._anon_get('/api/v1/recordings/my-rec/pages?user={user}&coll=temp')

        assert res.json == {'pages': []}

    def test_page_add_1(self):
        cdx_key = 'r:{user}:temp:my-rec:cdxj'.format(user=self.anon_user)
        self.redis.zadd(cdx_key, 0, 'com,example)/ 2016010203000000 {}')

        page = {'title': 'Example', 'url': 'http://example.com/', 'timestamp': '2016010203000000'}
        res = self._anon_post('/api/v1/recordings/my-rec/pages?user={user}&coll=temp', params=page)

        assert res.json == {}

    def test_page_list_1(self):
        res = self._anon_get('/api/v1/recordings/my-rec/pages?user={user}&coll=temp')

        assert res.json == {'pages': [{'title': 'Example', 'url': 'http://example.com/', 'timestamp': '2016010203000000'}]}

    def test_page_add_2(self):
        cdx_key = 'r:{user}:temp:my-rec:cdxj'.format(user=self.anon_user)
        self.redis.zadd(cdx_key, 0, 'com,example)/foo/bar 2016010203000000 {}')

        page = {'title': 'Example', 'url': 'http://example.com/foo/bar', 'timestamp': '2015010203000000'}
        res = self._anon_post('/api/v1/recordings/my-rec/pages?user={user}&coll=temp', params=page)

        assert res.json == {}

    def test_page_list_2(self):
        res = self._anon_get('/api/v1/recordings/my-rec/pages?user={user}&coll=temp')
        assert len(res.json['pages']) == 2
        assert {'title': 'Example', 'url': 'http://example.com/', 'timestamp': '2016010203000000'} in res.json['pages']
        assert {'title': 'Example', 'url': 'http://example.com/foo/bar', 'timestamp': '2015010203000000'} in res.json['pages']

    def test_page_delete(self):
        params = {'url': 'http://example.com/foo/bar', 'timestamp': '2015010203000000'}
        res = self._anon_delete('/api/v1/recordings/my-rec/pages?user={user}&coll=temp', params=params)
        assert res.json == {}

        res = self._anon_get('/api/v1/recordings/my-rec/pages?user={user}&coll=temp')
        assert len(res.json['pages']) == 1
        assert {'title': 'Example', 'url': 'http://example.com/', 'timestamp': '2016010203000000'} in res.json['pages']

    def test_collide_wb_url_format(self):
        res = self._anon_post('/api/v1/recordings?user={user}&coll=temp', params={'title': '2016'})
        assert res.json['recording']['id'] == '2016-'

    def test_collide_wb_url_format_2(self):
        res = self._anon_post('/api/v1/recordings?user={user}&coll=temp', params={'title': '2ab_'})
        assert res.json['recording']['id'] == '2ab_-'

    #def test_error_already_exists(self):
    #    res = self._anon_post('/api/v1/recordings?user={user}&coll=temp', params={'title': '2 Another Recording'}, status=400)
    #    assert res.json == {'error_message': 'Recording Already Exists', 'id': '2-another-recording', 'title': '2 Another! Recording!'}

    def test_error_no_such_rec(self):
        res = self._anon_get('/api/v1/recordings/blah@$?user={user}&coll=temp', status=404)
        assert res.json == {'error_message': 'Recording not found', 'id': 'blah@$'}

    def test_error_no_such_rec_pages(self):
        res = self._anon_get('/api/v1/recordings/my-rec3/pages?user={user}&coll=temp', status=404)
        assert res.json == {'error_message': 'Recording not found', 'id': 'my-rec3'}

        page = {'title': 'Example', 'url': 'http://example.com/foo/bar', 'timestamp': '2015010203000000'}
        res = self._anon_post('/api/v1/recordings/my-rec3/pages?user={user}&coll=temp', params=page, status=404)
        assert res.json == {'error_message': 'Recording not found', 'id': 'my-rec3', 'request_data': page}

    def test_error_missing_user_coll(self):
        res = self._anon_post('/api/v1/recordings', params={'title': 'Recording'}, status=400)
        assert res.json == {'error_message': "User must be specified", 'request_data': {'title': 'Recording'}}

    def test_error_invalid_user_coll(self):
        res = self._anon_post('/api/v1/recordings?user=user&coll=coll', params={'title': 'Recording'}, status=404)
        assert res.json == {"error_message": "No such user", 'request_data': {'title': 'Recording'}}

