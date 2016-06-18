import time
import os

from .testutils import BaseWRTests


# ============================================================================
class TestWebRecCollsAPI(BaseWRTests):
    def setup_class(cls):
        os.environ['WEBAGG_HOST'] = 'http://localhost:8080'
        os.environ['RECORD_HOST'] = 'http://localhost:8010'

        super(TestWebRecCollsAPI, cls).setup_class()

    def test_create_anon_coll(self):
        res = self.testapp.post('/api/v1/collections?user={user}'.format(user=self.anon_user), params={'title': 'Temp'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['collection']['id'] == 'temp'
        assert res.json['collection']['title'] == 'Temp'

        assert self.redis.exists('c:' + self.anon_user + ':temp:info')

    def test_create_anon_coll_dup(self):
        res = self.testapp.post('/api/v1/collections?user={user}'.format(user=self.anon_user), params={'title': 'Temp'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['collection']['id'] == 'temp-2'
        assert res.json['collection']['title'] == 'Temp 2'

        assert self.redis.exists('c:' + self.anon_user + ':temp-2:info')

    def test_get_anon_coll(self):
        res = self.testapp.get('/api/v1/collections/temp?user={user}'.format(user=self.anon_user))

        assert res.json['collection']
        rec = res.json['collection']

        assert rec['size'] == 0
        assert rec['id'] == 'temp'
        assert rec['title'] == 'Temp'
        assert rec['download_url'] == 'http://localhost:80/{user}/temp/$download'.format(user=self.anon_user)
        #assert rec['created_at'] == rec['updated_at']
        assert rec['created_at'] <= int(time.time())
        assert rec['recordings'] == []


    def test_list_anon_collections(self):
        res = self.testapp.get('/api/v1/collections?user={user}'.format(user=self.anon_user))

        colls = res.json['collections']
        assert len(colls) == 2

        colls.sort(key=lambda x: x['id'])

        assert colls[0]['id'] == 'temp'
        assert colls[0]['title'] == 'Temp'
        assert colls[0]['download_url'] == 'http://localhost:80/{user}/temp/$download'.format(user=self.anon_user)

        assert colls[1]['id'] == 'temp-2'
        assert colls[1]['title'] == 'Temp 2'
        assert colls[1]['download_url'] == 'http://localhost:80/{user}/temp-2/$download'.format(user=self.anon_user)

    #def test_error_already_exists(self):
    #    res = self.testapp.post('/api/v1/collections?user={user}'.format(user=self.anon_user), params={'title': 'temp'}, status=400)
    #    assert res.json == {'error_message': 'Collection already exists', 'id': 'temp', 'title': 'Temp'}

    def test_error_no_such_rec(self):
        res = self.testapp.get('/api/v1/collections/blah@$?user={user}'.format(user=self.anon_user), status=404)
        assert res.json == {'error_message': 'Collection not found', 'id': 'blah@$'}

    def test_error_missing_user_coll(self):
        res = self.testapp.post('/api/v1/collections', params={'title': 'Recording'}, status=400)
        assert res.json == {'error_message': "User must be specified", 'request_data': {'title': 'Recording'}}

    def test_error_invalid_user_coll(self):
        res = self.testapp.post('/api/v1/collections?user=user', params={'title': 'Example'}, status=404)
        assert res.json == {"error_message": "No such user", 'request_data': {'title': 'Example'}}

    def test_error_invalid_user_coll_2(self):
        res = self.testapp.post('/api/v1/collections?user=temp$123', params={'title': 'Example'}, status=404)
        assert res.json == {"error_message": "No such user", 'request_data': {'title': 'Example'}}


