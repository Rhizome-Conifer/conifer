from cork import Cork, AAAException
from beaker.middleware import SessionMiddleware
from cork.json_backend import JsonBackend
from redis import StrictRedis

import json
import os

from pywb.manager.manager import CollectionsManager
from loader import switch_dir


def init_cork(app, redis):
    cork = Cork(backend=RedisBackend(redis))

    session_opts = {
        'session.cookie_expires': True,
        'session.encrypt_key': 'TFSDFMWPEFJPSDF<MBSFBSDB',
        'session.httponly': True,
        'session.timeout': 3600 * 24,  # 1 day
        'session.type': 'cookie',
        'session.validate_key': True,
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
    InitCork.init_backend(RedisBackend(StrictRedis()))
