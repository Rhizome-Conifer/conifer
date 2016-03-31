from webagg.test.testutils import FakeRedisTests, BaseTestClass
import webtest
import time

from webrecorder.appcontroller import AppController
from fakeredis import FakeStrictRedis


# ============================================================================
class TestWebRec(FakeRedisTests, BaseTestClass):
    def setup_class(cls):
        super(TestWebRec, cls).setup_class()


        cls.appcont = AppController(configfile='./test/test_config.yaml')
        cls.testapp = webtest.TestApp(cls.appcont.app)

    def get_anon_user(self):
        anon_user = 'anon/' + self.testapp.cookies['__test_sesh'][-32:]
        return anon_user

    def test_home_page(self):
        res = self.testapp.get('/')
        assert 'Webrecorder' in res
        assert self.testapp.cookies == {}

    def test_create_anon_rec(self):
        res = self.testapp.post('/api/v1/recordings?user=@anon&coll=anonymous', params={'title': 'My Rec'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['recording']['id'] == 'my-rec'

        anon_user = self.get_anon_user()

        f = FakeStrictRedis.from_url('redis://localhost/2')

        assert f.exists('r:' + anon_user + ':anonymous:my-rec:info')

    def test_get_anon_rec(self):
        res = self.testapp.get('/api/v1/recordings/my-rec?user=@anon&coll=anonymous')

        assert res.json['status'] == 'success'
        assert res.json['recording']
        rec = res.json['recording']

        assert rec['size'] == 0
        assert rec['id'] == 'my-rec'
        assert rec['title'] == 'My Rec'
        assert rec['created_at'] == rec['updated_at']
        assert rec['created_at'] <= int(time.time())

    def test_create_another_anon_rec(self):
        res = self.testapp.post('/api/v1/recordings?user=@anon&coll=anonymous', params={'title': '2 Another! Recording!'})

        assert self.testapp.cookies['__test_sesh'] != ''

        assert res.json['recording']['id'] == '2-another-recording'

        anon_user = self.get_anon_user()

        f = FakeStrictRedis.from_url('redis://localhost/2')

        assert f.exists('r:' + anon_user + ':anonymous:2-another-recording:info')

    def test_list_all_recordings(self):
        res = self.testapp.get('/api/v1/recordings?user=@anon&coll=anonymous')

        recs = res.json['recordings']
        assert len(recs) == 2

        recs[0]['id'] == 'another-recording'
        recs[0]['title'] == '2 Another! Recording!'

        recs[1]['id'] == 'my-rec'
        recs[1]['title'] == 'My Rec'

    def test_collide_wb_url_format(self):
        res = self.testapp.post('/api/v1/recordings?user=@anon&coll=anonymous', params={'title': '2016'})
        assert res.json['recording']['id'] == '2016_'

    def test_collide_wb_url_format_2(self):
        res = self.testapp.post('/api/v1/recordings?user=@anon&coll=anonymous', params={'title': '2ab_'})
        assert res.json['recording']['id'] == '2ab__'

    def test_error_already_exists(self):
        res = self.testapp.post('/api/v1/recordings?user=@anon&coll=anonymous', params={'title': '2 Another Recording'}, status=400)
        assert res.json == {'status': 'AlreadyExists', 'id': '2-another-recording', 'title': '2 Another Recording'}

    def test_error_no_such_rec(self):
        res = self.testapp.get('/api/v1/recordings/blah@$?user=@anon&coll=anonymous', status=404)
        assert res.json == {'status': 'NotFound', 'id': 'blah@$'}

    def test_error_missing_user_coll(self):
        res = self.testapp.post('/api/v1/recordings', params={'title': 'Recording'}, status=400)
        assert res.json == {"status": "MissingUserColl", "message": "User and Collection must be specified"}

    def test_error_invalid_user_coll(self):
        res = self.testapp.post('/api/v1/recordings?user=user&coll=coll', params={'title': 'Recording'}, status=404)
        assert res.json == {"status": "InvalidUserColl", "message": "No Such User or Collection"}


