from datetime import datetime
import os

from .testutils import FullStackTests


# ============================================================================
class TestWebRecRecAPI(FullStackTests):
    def assert_rec_key(self, coll, rec):
        coll, rec = self.get_coll_rec(self.anon_user, coll, rec)

        assert self.redis.exists('r:' + rec + ':info')

    def test_create_anon_coll(self):
        res = self.testapp.post_json('/api/v1/collections?user={user}'.format(user=self.anon_user), params={'title': 'Temp'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['collection']['id'] == 'temp'
        assert res.json['collection']['title'] == 'Temp'

        coll, rec = self.get_coll_rec(self.anon_user, 'temp', None)

        assert self.redis.exists('c:' + coll + ':info')

    def test_create_anon_rec(self):
        res = self._anon_post('/api/v1/recordings?user={user}&coll=temp', params={'desc': 'My Rec Description'})

        assert self.testapp.cookies['__test_sesh'] != ''

        self.add_rec_id(res.json['recording']['id'])

        assert self.rec_ids[0].startswith('rec-')
        assert res.json['recording']['desc'] == 'My Rec Description'

        self.assert_rec_key('temp', self.rec_ids[0])

    def test_create_anon_rec_dup(self):
        res = self._anon_post('/api/v1/recordings?user={user}&coll=temp', params={'desc': 'Another Desc'})

        assert self.testapp.cookies['__test_sesh'] != ''

        self.add_rec_id(res.json['recording']['id'])
        assert self.rec_ids[0] != self.rec_ids[1]
        assert res.json['recording']['desc'] == 'Another Desc'

        self.assert_rec_key('temp', self.rec_ids[1])

    def test_anon_get_anon_rec(self):
        res = self._anon_get('/api/v1/recordings/{rec_id_0}?user={user}&coll=temp')

        assert res.json['recording']
        rec = res.json['recording']

        assert rec['size'] == 0
        assert rec['id'] == self.rec_ids[0]
        assert rec['desc'] == 'My Rec Description'
        #assert rec['download_url'] == 'http://localhost:80/{user}/temp/my-rec/$download'.format(user=self.anon_user)
        assert rec['created_at'] == rec['updated_at']
        assert rec['created_at'] <= datetime.utcnow().isoformat()
        assert self.ISO_DT_RX.match(rec['created_at'])
        assert self.ISO_DT_RX.match(rec['updated_at'])

    def test_create_another_anon_rec(self):
        res = self._anon_post('/api/v1/recordings?user={user}&coll=temp', params={'desc': '2 Another! Recording!'})

        assert self.testapp.cookies['__test_sesh'] != ''

        self.add_rec_id(res.json['recording']['id'])

        assert self.rec_ids[2].startswith('rec-')

        self.assert_rec_key('temp', self.rec_ids[2])

    def test_list_all_recordings(self):
        res = self._anon_get('/api/v1/recordings?user={user}&coll=temp')

        recs = res.json['recordings']
        assert len(recs) == 3

        recs.sort(key=lambda x: x['id'])

        assert recs[0]['id'] == self.rec_ids[0]
        assert recs[0]['desc'] == 'My Rec Description'

        assert recs[1]['id'] == self.rec_ids[1]
        assert recs[1]['desc'] == 'Another Desc'

        assert recs[2]['id'] == self.rec_ids[2]
        assert recs[2]['desc'] == '2 Another! Recording!'

    def test_page_list_0(self):
        res = self._anon_get('/api/v1/recordings/{rec_id_0}/pages?user={user}&coll=temp')

        assert res.json == {'pages': []}

    def test_page_add_1(self):
        cdx_key = 'r:{user}:temp:{rec_id}:cdxj'.format(user=self.anon_user,
                                                       rec_id=self.rec_ids[0])

        self.redis.zadd(cdx_key, 0, 'com,example)/ 2016010203000000 {}')

        page = {'title': 'Example', 'url': 'http://example.com/', 'timestamp': '2016010203000000'}
        res = self._anon_post('/api/v1/recordings/{rec_id_0}/pages?user={user}&coll=temp', params=page)

        assert res.json == {}

    def test_page_list_1(self):
        res = self._anon_get('/api/v1/recordings/{rec_id_0}/pages?user={user}&coll=temp')

        assert res.json == {'pages': [{'id': 'cf6e50ec2c', 'title': 'Example', 'url': 'http://example.com/', 'timestamp': '2016010203000000'}]}

    def test_page_add_2(self):
        cdx_key = 'r:{user}:temp:{rec_id}:cdxj'.format(user=self.anon_user, rec_id=self.rec_ids[0])
        self.redis.zadd(cdx_key, 0, 'com,example)/foo/bar 2016010203000000 {}')

        page = {'title': 'Example', 'url': 'http://example.com/foo/bar', 'timestamp': '2015010203000000'}
        res = self._anon_post('/api/v1/recordings/{rec_id_0}/pages?user={user}&coll=temp', params=page)

        assert res.json == {}

    def test_page_add_3_not_added_yet(self):
        cdx_key = 'r:{user}:temp:{rec_id}:cdxj'.format(user=self.anon_user, rec_id=self.rec_ids[0])

        page = {'title': 'Example', 'url': 'http://example.com/foo/other'}
        res = self._anon_post('/api/v1/recordings/{rec_id_0}/pages?user={user}&coll=temp', params=page)

        assert res.json == {}

    def test_page_list_2(self):
        res = self._anon_get('/api/v1/recordings/{rec_id_0}/pages?user={user}&coll=temp')
        assert len(res.json['pages']) == 3
        assert {'id': 'cf6e50ec2c', 'title': 'Example', 'url': 'http://example.com/', 'timestamp': '2016010203000000'} in res.json['pages']
        assert {'id': 'ce9820d103', 'title': 'Example', 'url': 'http://example.com/foo/bar', 'timestamp': '2015010203000000'} in res.json['pages']

    def test_coll_page_list(self):
        res = self._anon_get('/api/v1/collection/temp?user={user}')

        assert len(res.json['pages']) == 3
        assert {'id': 'cf6e50ec2c', 'title': 'Example', 'recording': self.rec_ids[0], 'url': 'http://example.com/', 'timestamp': '2016010203000000'} in res.json['pages']
        assert {'id': 'ce9820d103', 'title': 'Example', 'recording': self.rec_ids[0], 'url': 'http://example.com/foo/bar', 'timestamp': '2015010203000000'} in res.json['pages']

    def test_page_delete(self):
        params = {'url': 'http://example.com/foo/bar', 'timestamp': '2015010203000000'}
        res = self._anon_delete('/api/v1/recordings/{rec_id_0}/pages?user={user}&coll=temp', params=params)
        assert res.json == {}

        res = self._anon_get('/api/v1/recordings/{rec_id_0}/pages?user={user}&coll=temp')
        assert len(res.json['pages']) == 2
        assert {'id': 'cf6e50ec2c', 'title': 'Example', 'url': 'http://example.com/', 'timestamp': '2016010203000000'} in res.json['pages']

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

    def test_update_desc(self):
        test_desc = 'Test / Special Chars !'
        res = self._anon_post('/api/v1/recordings/{rec_id_0}/update_desc?user={user}&coll=temp', params={'desc': test_desc})

        res = res.json

        assert res['recording']['id'] == self.rec_ids[0]
        assert res['recording']['desc'] == test_desc
