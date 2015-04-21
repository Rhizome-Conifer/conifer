from cork import Cork, AAAException
from beaker.middleware import SessionMiddleware
from cork.json_backend import JsonBackend
from redis import StrictRedis

import json
import os
import re

from pywb.manager.manager import CollectionsManager, main as manager_main
from pywb.utils.canonicalize import calc_search_range

from loader import switch_dir

from pywb.warc.cdxindexer import iter_file_or_dir
from pywb.cdx.cdxobject import CDXObject

def init_cork(app, redis):
    backend=RedisBackend(redis)
    init_cork_backend(backend)

    cork = Cork(backend=backend,
                email_sender=redacted,
                smtp_url=redacted)

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


class ValidationException(Exception):
    pass


class RedisBackend(object):
    def __init__(self, redis):
        self.redis = redis
        self.users = RedisTable(self.redis, 'h:users')
        self.roles = RedisTable(self.redis, 'h:roles')
        self.pending_registrations = RedisTable(self.redis, 'h:register')

    def save_users(self): pass
    def save_roles(self): pass
    def save_pending_registrations(self): pass


class RedisTable(object):
    def __init__(self, redis, key):
        self.redis = redis
        self.key = key

    def __contains__(self, name):
        value = self.redis.hget(self.key, name)
        return value is not None

    def __setitem__(self, name, values):
        string = json.dumps(values)
        return self.redis.hset(self.key, name, string)

    def __getitem__(self, name):
        string = self.redis.hget(self.key, name)
        result = json.loads(string)
        if isinstance(result, dict):
            return RedisHashTable(self, name, result)
        else:
            return result

    def __iter__(self):
        keys = self.redis.hkeys(self.key)
        return iter(keys)

    def iteritems(self):
        coll_list = self.redis.hgetall(self.key)
        colls = {}
        for n, v in coll_list.iteritems():
            colls[n] = json.loads(v)

        return colls.iteritems()

    def pop(self, name):
        result = self[name]
        if result:
            self.redis.hdel(self.key, name)
        return result


class RedisHashTable(object):
    def __init__(self, redistable, key, thedict):
        self.redistable = redistable
        self.key = key
        self.thedict = thedict

    def __getitem__(self, name):
        return self.thedict[name]

    def __setitem__(self, name, value):
        self.thedict[name] = value
        self.redistable[self.key] = self.thedict

    def get(self, name, default_val):
        return self.thedict.get(name, default_val)

    def __nonzero__(self):
        return bool(self.thedict)


class CollsManager(object):
    WRITE_KEY = ':w'
    READ_KEY = ':r'
    PUBLIC = '@public'
    GROUP = 'g:'
    COLL_KEY = ':<colls>'
    PAGE_KEY = 'p:'

    DONE_WARC = 'done:warc:'

    USER_RX = re.compile(r'^[A-Za-z0-9][\w-]{2,15}$')
    RESTRICTED_NAMES = ['login', 'logout', 'user', 'admin', 'manager', 'guest', 'settings', 'profile']
    PASS_RX = re.compile(r'^(?=.*[\d\W])(?=.*[a-z])(?=.*[A-Z]).{8,}$')

    def __init__(self, cork, redis, path_router):
        self.cork = cork
        self.redis = redis
        self.path_router = path_router

    def curr_user_role(self):
        try:
            if self.cork.user_is_anonymous:
                return '', ''

            cu = self.cork.current_user
            return cu.username, cu.role
        except:
            return '', ''

    def _check_access(self, user, coll, type_):
        curr_user, curr_role = self.curr_user_role()

        # current user always has access, if collection exists
        if user == curr_user:
            return self.has_collection(user, coll)

        key = user + ':' + coll + type_

        if not curr_user:
            res = self.redis.hmget(key, self.PUBLIC)
        else:
            res = self.redis.hmget(key, self.PUBLIC, curr_user,
                                   self.GROUP + curr_role)

        return any(res)

    def _add_access(self, user, coll, type_, to_user):
        self.redis.hset(user + ':' + coll + type_, to_user, 1)

    def is_public(self, user, coll):
        key = user + ':' + coll + self.READ_KEY
        res = self.redis.hget(key, self.PUBLIC)
        return res == '1'

    def can_read_coll(self, user, coll):
        return self._check_access(user, coll, self.READ_KEY)

    def can_write_coll(self, user, coll):
        return self._check_access(user, coll, self.WRITE_KEY)

    # for now, equivalent to is_owner(), but a different
    # permission, and may change
    def can_admin_coll(self, user, coll):
        return self.is_owner(user)

    def is_owner(self, user):
        curr_user, curr_role = self.curr_user_role()
        return (user and user == curr_user)

    def has_user(self, user):
        return self.cork.user(user) is not None

    def _get_user_colls(self, user):
        return RedisTable(self.redis, 'h:' + user + self.COLL_KEY)

    def has_collection(self, user, coll):
        return coll in self._get_user_colls(user)

    def validate_user(self, user, email):
        if self.has_user(user):
            msg = 'User {0} already exists! Please choose a different username'
            msg = msg.format(user)
            raise ValidationException(msg)

        if not self.USER_RX.match(user) or user in self.RESTRICTED_NAMES:
            msg = 'The name {0} is not a valid username. Please choose a different username'
            msg = msg.format(user)
            raise ValidationException(msg)

        #TODO: check email?
        return True

    def validate_password(self, password, confirm):
        if password != confirm:
            raise ValidationException('Passwords do not match!')

        if not self.PASS_RX.match(password):
            raise ValidationException('Please choose a different password')

        return True

    def get_metadata(self, user, coll, name):
        table = self._get_user_colls(user)[coll]
        if not table:
            print('NO TABLE?')
            return None
        return table.get(name, '')

    def add_collection(self, user, coll, title, access):
        curr_user, curr_role = self.curr_user_role()

        if not self.USER_RX.match(coll):
            raise ValidationException('Invalid Collection Name')

        if curr_user != user:
            raise ValidationException('Only {0} can create this collection!'.format(curr_user))

        if self.has_collection(user, coll):
            raise ValidationException('Collection {0} already exists!'.format(coll))

        dir_ = self.path_router.get_user_account_root(user)
        if not os.path.isdir(dir_):
            os.makedirs(dir_)

        try:
            set_title = 'title={0}'.format(title)
            set_access = 'access={0}'.format(access)

            with switch_dir(dir_):
                manager_main(['init', coll])
                manager_main(['metadata', coll, '--set', set_title, set_access])

        except ValueError as e:
            raise ValidationException(str(e))

        except OSError as e:
            if e.errno == 17:
                msg = 'Collection ' + coll + ' already exists!'
            else:
                msg = str(e)
            raise ValidationException(msg)

        except Exception as e:
            msg = 'Error creating collection.. Try Again'
            raise ValidationException(msg)


        coll_data = {'title': title}

        #self.redis.hset('h:' + user + self.COLL_KEY, coll, json.dumps(coll_data))
        self._get_user_colls(user)[coll] = coll_data

        if access == 'public':
            self._add_access(user, coll, self.READ_KEY, self.PUBLIC)

    def list_collections(self, user):
        colls_table = self._get_user_colls(user)
        colls = {}
        for n, v in colls_table.iteritems():
            if self.can_read_coll(user, n):
                colls[n] = v
                v['path'] = self.path_router.get_coll_path(user, n)

        return colls

    def add_page(self, user, coll, pagedata):
        if not self.can_write_coll(user, coll):
            print('Cannot Write')
            return False

        url = pagedata['url']

        try:
            key, end_key = calc_search_range(url, 'exact')
        except:
            print('Cannot Cannon')
            return False

        result = self.redis.zrangebylex('cdxj:' + user + ':' + coll,
                                        '[' + key,
                                        '(' + end_key)
        if not result:
            print('NO CDX')
            return False

        last_cdx = CDXObject(result[-1])

        pagedata['ts'] = last_cdx['timestamp']

        self.redis.sadd(self.PAGE_KEY + user + ':' + coll, json.dumps(pagedata))

    def list_pages(self, user, coll):
        if not self.can_read_coll(user, coll):
            return []

        pagelist = self.redis.smembers(self.PAGE_KEY + user + ':' + coll)
        pagelist = map(json.loads, pagelist)
        return pagelist

    def list_warcs(self, user, coll):
        if not self.can_admin_coll(user, coll):
            return []

        archive_dir = self.path_router.get_archive_dir(user, coll)

        warcs = []

        for fullpath, filename in iter_file_or_dir([archive_dir]):
            stats = os.stat(fullpath)
            res = {'size': stats.st_size,
                   'mtime': stats.st_mtime,
                   'name': filename}
            warcs.append(res)

        donewarcs = self.redis.smembers(self.DONE_WARC + user + ':' + coll)
        for stats in donewarcs:
            print(stats)
            res = json.loads(stats)
            warcs.append(res)

        return warcs


def init_cork_backend(backend):
    class InitCork(Cork):
        @property
        def current_user(self):
            class MockUser(object):
                @property
                def level(self):
                    return 100
            return MockUser()

    try:
        cork = InitCork(backend=backend)
        cork.create_role('archivist', 50)
    except:
        pass

    #cork.create_user('ilya', 'archivist', 'test', 'ilya@ilya', 'ilya')
    #cork.create_user('other', 'archivist', 'test', 'ilya@ilya', 'ilya')
    #cork.create_user('another', 'archivist', 'test', 'ilya@ilya', 'ilya')

    #cork.create_role('admin', 100)
    #cork.create_role('reader', 20)

    #cork.create_user('admin', 'admin', 'admin', 'admin@test', 'The Admin')
    #cork.create_user('ilya', 'archivist', 'test', 'ilya@ilya', 'ilya')
    #cork.create_user('guest', 'reader', 'test', 'ilya@ilya', 'ilya')
    #cork.create_user('ben', 'admin', 'ben', 'ilya@ilya', 'ilya')

if __name__ == "__main__":
    init_cork_backend(RedisBackend(StrictRedis.from_url('redis://127.0.0.1:6379/1')))
