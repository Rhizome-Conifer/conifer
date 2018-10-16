from .testutils import FullStackTests

import os
import gevent


# ============================================================================
class TestPending(FullStackTests):
    def get_pending_count(self, rec):
        key = 'r:{0}:_pc'.format(rec)
        assert self.redis.ttl(key) > 0
        return int(self.redis.get(key))

    def get_pending_size(self, rec):
        key = 'r:{0}:_ps'.format(rec)
        assert self.redis.ttl(key) > 0
        return int(self.redis.get(key))

    def test_record_check_pending_1(self):
        self.set_uuids('Recording', ['rec'])
        url = 'http://httpbin.org/drip'
        res = self.testapp.get('/_new/temp/rec/record/mp_/' + url)
        assert res.headers['Location'].endswith('/' + self.anon_user + '/temp/rec/record/mp_/' + url)

        def wait_for_res(res):
            res = res.follow()
            return res

        ge_req = gevent.spawn(wait_for_res, res)

        def assert_pending():
            assert self.get_pending_count('rec') == 2
            assert self.get_pending_size('rec') > 0

        self.sleep_try(0.2, 10.0, assert_pending)

        gevent.joinall([ge_req])

        res = ge_req.value

        # pending size and count should be 0
        assert self.get_pending_count('rec') == 0
        assert self.get_pending_size('rec') == 0

        TestPending.size = int(self.redis.hget('r:rec:info', 'size'))
        assert TestPending.size > 0

    def test_record_delete_while_pending_request(self):
        anon_dir = os.path.join(self.warcs_dir, self.anon_user)
        assert len(os.listdir(anon_dir)) == 1

        self.set_uuids('Recording', ['rec-a'])
        url = 'http://httpbin.org/delay/2'
        res = self.testapp.get('/_new/temp/rec-a/record/mp_/' + url)
        assert res.headers['Location'].endswith('/' + self.anon_user + '/temp/rec-a/record/mp_/' + url)

        def wait_for_res(res):
            res = res.follow()
            res.charset = 'utf-8'
            return res

        ge_req = gevent.spawn(wait_for_res, res)

        def assert_pending():
            # waiting for request, pending_count max of 1
            assert self.get_pending_count('rec-a') == 1
            assert self.get_pending_size('rec-a') > 0

        self.sleep_try(0.2, 10.0, assert_pending)

        # warc written
        def assert_written():
            assert len(os.listdir(anon_dir)) == 2

        self.sleep_try(0.2, 10.0, assert_written)

        res = self.testapp.delete('/api/v1/recording/rec-a?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'rec-a'}

        gevent.joinall([ge_req])

        res = ge_req.value

        assert '"' + url + '"' in res.text, res.text

        # rec info should be empty, as recording has been deleted
        assert self.redis.hgetall('r:rec-a:info') == {}
        assert not self.redis.exists('r:rec-a:_pc')
        assert not self.redis.exists('r:rec-a:_ps')

        def assert_deleted():
            assert self.redis.hgetall('r:rec-a:info') == {}
            assert len(os.listdir(anon_dir)) == 1

        self.sleep_try(0.2, 10.0, assert_deleted)


    def test_record_delete_while_pending_response(self):
        self.set_uuids('Recording', ['rec-a'])
        url = 'http://httpbin.org/drip'
        res = self.testapp.get('/_new/temp/rec-a/record/mp_/' + url)
        assert res.headers['Location'].endswith('/' + self.anon_user + '/temp/rec-a/record/mp_/' + url)

        def wait_for_res(res):
            res = res.follow()
            return res

        ge_req = gevent.spawn(wait_for_res, res)

        def assert_pending():
            # waiting for response, pending count includes request
            assert self.get_pending_count('rec-a') == 2
            assert self.get_pending_size('rec-a') > 0

        self.sleep_try(0.2, 10.0, assert_pending)

        res = self.testapp.delete('/api/v1/recording/rec-a?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'rec-a'}

        gevent.joinall([ge_req])

        res = ge_req.value
        assert len(res.body) == 10

        # rec info should be empty, as recording has been deleted
        assert self.redis.hgetall('r:rec-a:info') == {}

    def test_record_multiple_check_pending(self):
        url = 'http://httpbin.org/drip'
        self.set_uuids('Recording', ['rec-a'])

        params = {'coll': 'temp',
                  'mode': 'record',
                  'url': url,
                 }

        res = self.testapp.post_json('/api/v1/new', params=params)
        assert res.json['rec_name'] != ''

        def assert_pending():
            assert self.get_pending_count('rec-a') > 0
            assert self.get_pending_size('rec-a') > 0

        # SAME URL (DEDUP)
        def wait_for_res(res):
            res = self.testapp.get('/{user}/temp/rec-a/record/mp_/'.format(user=self.anon_user) + url)
            return res

        ge_reqs = [gevent.spawn(wait_for_res, res) for x in range(0, 5)]

        self.sleep_try(0.2, 10.0, assert_pending)

        gevent.joinall(ge_reqs)

        # pending size & count should be empty
        assert self.get_pending_count('rec-a') == 0
        assert self.get_pending_size('rec-a') == 0

        # assert 5 cdxj entry (deduped, revisit records written)
        all_cdxj = self.redis.zrange('r:rec-a:cdxj', 0, -1)
        assert len(all_cdxj) == 5

        # assert 4 are revisit records
        assert len([cdxj for cdxj in all_cdxj if 'revisit' in cdxj]) == 4

        # UNIQUE URLS
        # add param= to generate unique url
        def wait_for_res_uniq(res, count):
            res = self.testapp.get('/{user}/temp/rec-a/record/mp_/'.format(user=self.anon_user) + url + '?param=' + count)
            return res

        ge_reqs = [gevent.spawn(wait_for_res_uniq, res, str(x)) for x in range(0, 5)]

        self.sleep_try(0.2, 10.0, assert_pending)

        gevent.joinall(ge_reqs)

        # pending size & count should be empty
        assert self.get_pending_count('rec-a') == 0
        assert self.get_pending_size('rec-a') == 0

        # assert 10 cdxj entries
        all_cdxj = self.redis.zrange('r:rec-a:cdxj', 0, -1)
        assert len(all_cdxj) == 10

        # assert 4 are revisit records
        assert len([cdxj for cdxj in all_cdxj if 'revisit' in cdxj]) == 4

        # assert collection size increased
        coll, rec = self.get_coll_rec(self.anon_user, 'temp', '')
        assert int(self.redis.hget('c:{0}:info'.format(coll), 'size')) > TestPending.size

        # DELETE
        res = self.testapp.delete('/api/v1/recording/rec-a?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'rec-a'}

        def assert_deleted():
            assert self.redis.hgetall('r:rec-a:info') == {}
            anon_dir = os.path.join(self.warcs_dir, self.anon_user)
            # 2 recordings previously, should only have 1 left
            assert len(os.listdir(anon_dir)) == 1

        self.sleep_try(0.2, 10.0, assert_deleted)

    def test_record_multiple_delete(self):
        url = 'http://httpbin.org/drip'
        self.set_uuids('Recording', ['rec-b'])

        params = {'coll': 'temp',
                  'mode': 'record',
                  'url': url,
                 }

        res = self.testapp.post_json('/api/v1/new', params=params)
        assert res.json['rec_name'] != ''

        # UNIQUE URLS
        # add param= to generate unique url
        def wait_for_res_uniq(res, count):
            res = self.testapp.get('/{user}/temp/rec-b/record/mp_/'.format(user=self.anon_user) + url + '?param=' + count)
            return res

        ge_reqs = [gevent.spawn(wait_for_res_uniq, res, str(x)) for x in range(0, 5)]

        def assert_pending():
            assert self.get_pending_count('rec-b') > 0
            assert self.get_pending_size('rec-b') > 0

        self.sleep_try(0.2, 10.0, assert_pending)

        # DELETE WHILE PENDING
        res = self.testapp.delete('/api/v1/recording/rec-b?user={user}&coll=temp'.format(user=self.anon_user))

        assert res.json == {'deleted_id': 'rec-b'}

        # WAIT FOR FINISH
        gevent.joinall(ge_reqs)

        for ge in ge_reqs:
            assert len(ge.value.body) == 10

        # assert no pending data
        assert self.redis.hgetall('r:rec-b:info') == {}
        assert not self.redis.exists('r:rec-b:_pc')
        assert not self.redis.exists('r:rec-b:_ps')

    def test_user_and_coll_size(self):
        coll, rec = self.get_coll_rec(self.anon_user, 'temp', '')
        assert int(self.redis.hget('c:{0}:info'.format(coll), 'size')) == TestPending.size
        assert int(self.redis.hget('u:{0}:info'.format(self.anon_user), 'size')) == TestPending.size

