from datetime import datetime
import os

from .testutils import FullStackTests


# ============================================================================
class TestWebRecCollsAPI(FullStackTests):
    @classmethod
    def setup_class(cls):
        super(TestWebRecCollsAPI, cls).setup_class()

    def test_create_anon_coll(self):
        res = self.testapp.post_json('/api/v1/collections?user={user}'.format(user=self.anon_user), params={'title': 'Temp'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['collection']['id'] == 'temp'
        assert res.json['collection']['title'] == 'Temp'

    def test_create_anon_coll_dup_error(self):
        res = self.testapp.post_json('/api/v1/collections?user={user}'.format(user=self.anon_user),
                                     params={'title': 'Temp'}, status=400)

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json == {'error': 'duplicate_name'}

    def test_get_anon_coll(self):
        res = self.testapp.get('/api/v1/collection/temp?user={user}'.format(user=self.anon_user))

        assert res.json['collection']
        coll = res.json['collection']

        assert coll['size'] == 0
        assert coll['id'] == 'temp'
        assert coll['slug'] == 'temp'
        assert coll['title'] == 'Temp'
        assert coll['slug_matched'] == True
        assert coll['created_at'] <= datetime.utcnow().isoformat()

        assert self.ISO_DT_RX.match(coll['created_at'])
        assert self.ISO_DT_RX.match(coll['updated_at'])

        assert coll['recordings'] == []
        assert coll['public'] == False
        assert coll['public_index'] == False

    def test_get_anon_coll_wrong_user(self):
        res = self.testapp.get('/api/v1/collection/temp?user=temp-ABC', status=404)

        assert res.json['error'] == 'no_such_user'

    def test_list_anon_collections(self):
        res = self.testapp.get('/api/v1/collections?user={user}'.format(user=self.anon_user))

        colls = res.json['collections']
        assert len(colls) == 1

        colls.sort(key=lambda x: x['id'])

        assert colls[0]['id'] == 'temp'
        assert colls[0]['title'] == 'Temp'
        assert 'pages' not in colls[0]
        assert 'recordings' not in colls[0]
        assert 'lists' not in colls[0]
        #assert colls[0]['download_url'] == 'http://localhost:80/{user}/temp/$download'.format(user=self.anon_user)

    def test_error_no_title(self):
        res = self.testapp.post_json('/api/v1/collections?user={user}'.format(user=self.anon_user), status=400)

        assert res.json['error'] == 'invalid_coll_name'

    def test_error_invalid_temp_title(self):
        res = self.testapp.post_json('/api/v1/collections?user={user}'.format(user=self.anon_user),
                                     params={'title': 'new'}, status=400)

        assert res.json['error'] == 'invalid_temp_coll_name'

    def test_error_external_not_allowed(self):
        params = {'external': True,
                  'title': 'temp'
                 }

        res = self.testapp.post_json('/api/v1/collections?user={user}'.format(user=self.anon_user), params=params,
                                     status=403)

        assert res.json == {'error': 'external_not_allowed'}

    def test_error_no_such_coll(self):
        res = self.testapp.get('/api/v1/collection/blah@$?user={user}'.format(user=self.anon_user), status=404)
        assert res.json == {'error': 'no_such_collection'}

    def test_error_missing_user_coll(self):
        res = self.testapp.post_json('/api/v1/collections', params={'title': 'Recording'}, status=400)
        assert res.json == {'error': 'no_user_specified'}

    def test_error_invalid_user_coll(self):
        res = self.testapp.post_json('/api/v1/collections?user=user', params={'title': 'Example'}, status=404)
        assert res.json == {'error': 'no_such_user'}

    def test_error_invalid_user_coll_2(self):
        res = self.testapp.post_json('/api/v1/collections?user=temp$123', params={'title': 'Example'}, status=404)
        assert res.json == {'error': 'no_such_user'}

    def test_delete_coll(self):
        res = self.testapp.delete('/api/v1/collection/temp?user={user}'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'temp'}

