from datetime import datetime
import os

from .testutils import BaseWRTests


# ============================================================================
class TestWebRecCollsAPI(BaseWRTests):
    def setup_class(cls):
        super(TestWebRecCollsAPI, cls).setup_class()

    def test_create_anon_coll(self):
        res = self.testapp.post_json('/api/v1/collections?user={user}'.format(user=self.anon_user), params={'title': 'Temp'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['collection']['id'] == 'temp'
        assert res.json['collection']['title'] == 'Temp'

    def test_create_anon_coll_dup_error(self):
        res = self.testapp.post_json('/api/v1/collections?user={user}'.format(user=self.anon_user),
                                     params={'title': 'Temp'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert 'error_message' in res.json

    def test_get_anon_coll(self):
        res = self.testapp.get('/api/v1/collection/temp?user={user}'.format(user=self.anon_user))

        assert res.json['collection']
        coll = res.json['collection']

        assert coll['size'] == 0
        assert coll['id'] == 'temp'
        assert coll['title'] == 'Temp'
        assert coll['created_at'] <= datetime.utcnow().isoformat()

        assert self.ISO_DT_RX.match(coll['created_at'])
        assert self.ISO_DT_RX.match(coll['updated_at'])

        assert coll['recordings'] == []

    def test_list_anon_collections(self):
        res = self.testapp.get('/api/v1/collections?user={user}'.format(user=self.anon_user))

        colls = res.json['collections']
        assert len(colls) == 1

        colls.sort(key=lambda x: x['id'])

        assert colls[0]['id'] == 'temp'
        assert colls[0]['title'] == 'Temp'
        #assert colls[0]['download_url'] == 'http://localhost:80/{user}/temp/$download'.format(user=self.anon_user)

    def test_error_no_such_coll(self):
        res = self.testapp.get('/api/v1/collection/blah@$?user={user}'.format(user=self.anon_user), status=404)
        #assert res.json == {'error_message': 'Collection not found', 'id': 'blah@$'}
        assert res.json == {'error_message': 'No such collection'}

    def test_error_missing_user_coll(self):
        res = self.testapp.post_json('/api/v1/collections', params={'title': 'Recording'}, status=400)
        assert res.json == {'error_message': "User must be specified", 'request_data': {'title': 'Recording'}}

    def test_error_invalid_user_coll(self):
        res = self.testapp.post_json('/api/v1/collections?user=user', params={'title': 'Example'}, status=404)
        assert res.json == {"error_message": "No such user", 'request_data': {'title': 'Example'}}

    def test_error_invalid_user_coll_2(self):
        res = self.testapp.post_json('/api/v1/collections?user=temp$123', params={'title': 'Example'}, status=404)
        assert res.json == {"error_message": "No such user", 'request_data': {'title': 'Example'}}

    def test_delete_coll(self):
        res = self.testapp.delete('/api/v1/collection/temp?user={user}'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'temp'}

