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
        res = self.testapp.post('/api/v1/collections?user=@anon', params={'title': 'Anonymous'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['collection']['id'] == 'anonymous'

        anon_user = self.get_anon_user()

        assert self.redis.exists('c:' + anon_user + ':anonymous:info')

    def test_get_anon_coll(self):
        res = self.testapp.get('/api/v1/collections/anonymous?user=@anon')

        assert res.json['collection']
        rec = res.json['collection']

        assert rec['size'] == 0
        assert rec['id'] == 'anonymous'
        assert rec['title'] == 'Anonymous'
        assert rec['download_url'] == 'http://localhost:80/anonymous/$download'
        #assert rec['created_at'] == rec['updated_at']
        assert rec['created_at'] <= int(time.time())
        assert rec['recordings'] == []


    def test_list_anon_collections(self):
        res = self.testapp.get('/api/v1/collections?user=@anon')

        recs = res.json['collections']
        assert len(recs) == 1

        assert recs[0]['id'] == 'anonymous'
        assert recs[0]['title'] == 'Anonymous'
        assert recs[0]['download_url'] == 'http://localhost:80/anonymous/$download'

    def test_error_already_exists(self):
        res = self.testapp.post('/api/v1/collections?user=@anon', params={'title': 'anonymous'}, status=400)
        assert res.json == {'error_message': 'Collection already exists', 'id': 'anonymous', 'title': 'Anonymous'}

    def test_error_no_such_rec(self):
        res = self.testapp.get('/api/v1/collections/blah@$?user=@anon', status=404)
        assert res.json == {'error_message': 'Collection not found', 'id': 'blah@$'}

    def test_error_missing_user_coll(self):
        res = self.testapp.post('/api/v1/collections', params={'title': 'Recording'}, status=400)
        assert res.json == {'error_message': "User must be specified"}

    def test_error_invalid_user_coll(self):
        res = self.testapp.post('/api/v1/collections?user=user', params={'title': 'Example'}, status=404)
        assert res.json == {"error_message": "No such user"}

