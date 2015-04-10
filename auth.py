from cork import Cork, AAAException
from beaker.middleware import SessionMiddleware
from cork.json_backend import JsonBackend
from redis import StrictRedis

import json
import os

from pywb.manager.manager import CollectionsManager, main as manager_main
from loader import switch_dir

from pywb.warc.cdxindexer import iter_file_or_dir



def init_cork(app, redis):
    cork = Cork(backend=RedisBackend(redis))

    session_opts = {
        'session.cookie_expires': True,
        'session.encrypt_key': 'TFSDFMWPEFJPSDSDFSDFENWO',
        'session.httponly': True,
        'session.timeout': 3600 * 24,  # 1 day
        'session.type': 'cookie',
        'session.validate_key': True,
        'session.cookie_path': '/',
    }

    app = SessionMiddleware(app, session_opts)
    return app, cork



class RedisBackend(JsonBackend):
    def __init__(self, redis):
        self.redis = redis
        super(RedisBackend, self).__init__('conf')

    def _loadjson(self, fname, dest):
        json_data = self.redis.get('t:' + fname)
        if not json_data:
            json_obj = {}
        else:
            json_obj = json.loads(json_data)
        dest.clear()
        dest.update(json_obj)

    def _savejson(self, fname, obj):
        json_data = json.dumps(obj)
        self.redis.set('t:' + fname, json_data)



class RedisTable(object):
    def __init__(self, redis_obj, key):
        self.redis_obj = redis_obj
        self.key = key

    def __contains__(self, name):
        value = self.redis_obj.hget(self.key, name)
        return value is not None

    def __setitem__(self, name, values):
        string = json.dumps(values)
        return self.redis_obj.hset(self.key, name, string)

    def __getitem__(self, name):
        string = self.redis_obj.hget(self.key, name)
        try:
            return json.loads(string)
        except:
            print(string)
            return {}

    def get_all(self):
        coll_list = self.redis_obj.hgetall(self.key)
        colls = {}
        for n, v in coll_list.iteritems():
            colls[n] = json.loads(v)

        return colls

class CollsManager(object):
    def __init__(self, cork, redis):
        self.cork = cork
        self.redis = redis

        self.collections = RedisTable(redis, 'colls')

    def add_collection(self, coll_name, title, access):
        success = False

        if self.has_collection(coll_name):
            msg = 'Collection ' + coll_name + ' already exists!'
            return success, msg

        self.collections[coll_name] = {'title': title,
                                       'access': access}
        try:
            manager_main(['init', coll_name])

            title = 'title={0}'.format(title)
            access = 'access={0}'.format(access)
            manager_main(['metadata', coll_name, '--set', title, access])
            msg = 'Created Collection ' + coll_name
            success = True
        except ValueError as e:
            msg = str(e)

        except OSError as e:
            if e.errno == 17:
                msg = 'Collection ' + coll_name + ' already exists!'
            else:
                msg = str(e)

        except Exception as e:
            msg = 'Error creating collection.. Try Again'

        return success, msg

    def _can_read_coll_obj(self, coll):
        if not coll:
            return False

        if coll['access'] == 'public':
            return True

        try:
            self.cork.require(role='reader')
            return True
        except AAAException:
            return False

    def list_collections(self):
        all_colls = self.collections.get_all()
        colls = {}
        for n, v in all_colls.iteritems():
            if self._can_read_coll_obj(v):
                colls[n] = v

        return colls

    def has_collection(self, coll_name):
        return coll_name in self.collections

    def can_read_coll(self, coll_name):
        coll = self.collections[coll_name]
        return self._can_read_coll_obj(coll)

    def can_record_coll(self, coll_name):
        coll = self.collections[coll_name]
        if not coll:
            return False

        try:
            self.cork.require(role='archivist')
            return True
        except AAAException:
            return False

    def list_warcs(self, coll):
        archive_dir = os.path.join('collections', coll, 'archive')

        warcs = []

        for fullpath, filename in iter_file_or_dir([archive_dir]):
            warcs.append(filename)

        return warcs







class UserCollsManager(object):
    def __init__(self, cork, redis):
        self.cork = cork
        self.redis = redis

    def _is_admin(self):
        try:
            self.cork.require(role='admin')
            return True
        except AAAException:
            return False

    def user_exists(self, user):
        return self.cork.user(user) is not None

    def is_user(self, user):
        try:
            self.cork.require(username=user)
            return True
        except AAAException:
            return False

    def list_colls(self, user):
        colls = []
        userinfo = self.redis.smembers('u:' + user)

        if not userinfo:
            return colls

        for v in userinfo:
            if not v.startswith('c:'):
                continue

            coll = v[2:]
            if self.can_user_read(user, coll):
                colls.append(coll)

        return colls

    def add_collection(self, user, coll, access):
        if not self.can_user_create_coll(user, coll):
            return False, 'Not allowed to create new collection'

        path = os.path.join('users', user)

        try:
            with switch_dir(path) as _:
                wb_manager = CollectionsManager(coll, must_exist=False)
                wb_manager.add_collection()
        except ValueError as e:
            return False, str(e)

        except OSError as e:
            if e.errno == 17:
                msg = 'Collection ' + coll + ' already exists!'
            else:
                msg = str(e)
            return False, msg

        except Exception as e:
            print(e)
            return False, 'Error creating collection.. Try Again'

        # Add to user
        self.redis.sadd('u:' + user, 'c:' + coll)

        # Add to collection
        if access:
            access = 'public'
        else:
            access = 'private'

        self.redis.hset('c:' + user + ':' + coll, 'access', access)

        return True, 'Collection: ' + coll + ' created!'

    def can_user_read(self, user, coll):
        if not self.user_exists(user):
            return False

        access = self.redis.hget('c:' + user + ':' + coll, 'access')
        if access is None:
            return False

        if access != 'public':
            if not self.is_user(user):
                return False

        if not os.path.isdir(os.path.join('users', user,
                                          'collections', coll)):
            return False

        return True

    def can_user_record(self, user, coll):
        if self.is_user(user):
            return True

        return False

    def can_user_create_coll(self, user, coll):
        if self.is_user(user) or self._is_admin():
            return True

        return False


class InitCork(Cork):
    @property
    def current_user(self):
        class MockUser(object):
            @property
            def level(self):
                return 100
        return MockUser()

    @staticmethod
    def init_backend(backend):
        cork = InitCork(backend=backend)
        cork.create_role('admin', 100)
        cork.create_role('archivist', 50)
        cork.create_role('reader', 20)

        cork.create_user('admin', 'admin', 'admin', 'admin@test', 'The Admin')
        cork.create_user('ilya', 'archivist', 'test', 'ilya@ilya', 'ilya')
        cork.create_user('guest', 'reader', 'test', 'ilya@ilya', 'ilya')

if __name__ == "__main__":
    InitCork.init_backend(RedisBackend(StrictRedis.from_url('redis://127.0.0.1:6379/2')))
