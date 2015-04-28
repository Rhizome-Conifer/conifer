from cork import Cork, AAAException
from beaker.middleware import SessionMiddleware
from cork.json_backend import JsonBackend
from redis import StrictRedis

import json
import os
import re
import base64
import shutil

from pywb.manager.manager import CollectionsManager, main as manager_main
from pywb.utils.canonicalize import calc_search_range

from loader import switch_dir

from cookieguard import CookieGuard

from pywb.warc.cdxindexer import iter_file_or_dir
from pywb.cdx.cdxobject import CDXObject
from pywb.utils.loaders import load_yaml_config


def create_cork(redis):
    backend=RedisBackend(redis)
    init_cork_backend(backend)

    cork = Cork(backend=backend,
                email_sender=redacted,
                smtp_url=redacted)
    return cork

def init_manager_for_invite(configfile='config.yaml'):
    config = load_yaml_config(configfile)

    redis_url = config['redis_url']

    redis_obj = StrictRedis.from_url(redis_url)

    cork = create_cork(redis_obj)

    manager = CollsManager(cork, redis_obj, None, None)
    return manager


def init_cork(app, redis, config):
    cork = create_cork(redis)

    encrypt_key = 'FQbitfnuOZbB2gPvb4G4h5UfOssLU49jI6Kg'

    session_opts = {
        'session.cookie_expires': True,
        'session.encrypt_key': encrypt_key,
        'session.httponly': True,
        'session.timeout': 3600 * 24,  # 1 day
        'session.type': 'cookie',
        'session.validate_key': True,
        'session.cookie_path': '/',
        'session.secure': False,
        'session.key': config['cookie_name'],
    }

    app = CookieGuard(app, config['cookie_name'])
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

    def __delitem__(self, name):
        return self.redis.hdel(self.key, name)

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

    def __delitem__(self, entry):
        del self.thedict[name]
        self.redistable[self.key] = self.thedict

    def get(self, name, default_val=''):
        return self.thedict.get(name, default_val)

    def __nonzero__(self):
        return bool(self.thedict)

class CollsManager(object):
    COLL_KEY = ':<colls>'

    PUBLIC = '@public'
    GROUP = 'g:'

    WRITE_KEY = ':w'
    READ_KEY = ':r'
    PAGE_KEY = ':p'
    Q_KEY = ':q'

    DEDUP_KEY = ':d'
    CDX_KEY = ':cdxj'
    WARC_KEY = ':warc'
    DONE_WARC_KEY = ':warc:done'

    ALL_KEYS = [WRITE_KEY, READ_KEY, PAGE_KEY, Q_KEY,
                DEDUP_KEY, CDX_KEY, WARC_KEY, DONE_WARC_KEY]

    USER_RX = re.compile(r'^[A-Za-z0-9][\w-]{2,15}$')
    RESTRICTED_NAMES = ['login', 'logout', 'user', 'admin', 'manager', 'guest', 'settings', 'profile']
    PASS_RX = re.compile(r'^(?=.*[\d\W])(?=.*[a-z])(?=.*[A-Z]).{8,}$')
    WARC_RX = re.compile(r'^[\w.-]+$')

    def __init__(self, cork, redis, path_router, remotemanager):
        self.cork = cork
        self.redis = redis
        self.path_router = path_router
        self.remotemanager = remotemanager

    def make_key(self, user, coll, type_=''):
        return user + ':' + coll + type_

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

        key = self.make_key(user, coll, type_)

        if not curr_user:
            res = self.redis.hmget(key, self.PUBLIC)
        else:
            res = self.redis.hmget(key, self.PUBLIC, curr_user,
                                   self.GROUP + curr_role)

        return any(res)

    def _add_access(self, user, coll, type_, to_user):
        self.redis.hset(self.make_key(user, coll, type_), to_user, 1)

    def is_public(self, user, coll):
        key = self.make_key(user, coll, self.READ_KEY)
        res = self.redis.hget(key, self.PUBLIC)
        return res == '1'

    def set_public(self, user, coll, public):
        if not self.can_admin_coll(user, coll):
            return False

        key = self.make_key(user, coll, self.READ_KEY)
        if public:
            self.redis.hset(key, self.PUBLIC, 1)
        else:
            self.redis.hdel(key, self.PUBLIC)

        return True

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
        return RedisTable(self.redis, 'u:' + user + self.COLL_KEY)

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

    def is_valid_invite(self, invitekey):
        try:
            if not invitekey:
                return False

            key = base64.b64decode(invitekey)
            key.split(':', 1)
            email, hash_ = key.split(':', 1)

            table = RedisTable(self.redis, 'h:invites')
            entry = table[email]

            if entry and entry.get('hash_') == hash_:
                return email
        except Exception as e:
            print(e)
            pass

        msg = 'Sorry, that is not a valid invite code. Please try again or request another invite'
        raise ValidationException(msg)

    def save_invite(self, email, name, desc=''):
        if not email or not name:
            return False

        table = RedisTable(self.redis, 'h:invites')
        table[email] = {'name': name, 'email': email, 'desc': desc}
        return True

    def send_invite(self, email, email_template, host):
        table = RedisTable(self.redis, 'h:invites')
        entry = table[email]
        if not entry:
            return False

        hash_ = base64.b64encode(os.urandom(21))
        entry['hash_'] = hash_

        invitekey = base64.b64encode(email + ':' + hash_)
        import bottle

        email_text = bottle.template(
            email_template,
            host=host,
            email_addr=email,
            name=entry.get('name', email),
            invite=invitekey,
        )
        self.cork.mailer.send_email(email, 'You are invited to join webrecorder.io!', email_text)
        return True

    def get_metadata(self, user, coll, name, def_val=''):
        table = self._get_user_colls(user)[coll]
        if not table:
            print('NO TABLE?')
            return None
        return table.get(name, def_val)

    def set_metadata(self, user, coll, name, value):
        if not self.can_write_coll(user, coll):
            return False

        table = self._get_user_colls(user)[coll]
        table[name] = value
        return True

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

    def delete_collection(self, user, coll):
        if not self.can_admin_coll(user, coll):
            return False

        base_key = self.make_key(user, coll)
        keys = map(lambda x: base_key + x, self.ALL_KEYS)
        #key_q = '*' + user + ':' + coll + '*'
        #keys = self.redis.keys(key_q)

        # delete all coll keys
        if keys:
            self.redis.delete(*keys)

        # delete local coll
        coll_dir = self.path_router.get_coll_root(user, coll)

        # remove dir (TODO: warcprox notify?)
        if os.path.isdir(coll_dir):
            shutil.rmtree(coll_dir)


        rel_dir = os.path.relpath(coll_dir, self.path_router.root_dir) + '/'

        # delete from s3
        self.remotemanager.delete_coll(rel_dir)


        # delete collection entry
        del self._get_user_colls(user)[coll]

        return True

    def get_info(self, user, coll):
        if not self.can_read_coll(user, coll):
            return {}

        key = self.make_key(user, coll, self.DEDUP_KEY)
        res = self.redis.hmget(key, ['total_len', 'warc_len', 'num_urls'])
        #num_pages = self.redis.scard(self.PAGE_KEY + key)
        return {'total_size': res[0],
                'curr_size': res[1],
                'num_urls': res[2]
               }
                #'pages': num_pages}

    def add_to_queue(self, user, coll, data):
        if not self.can_write_coll(user, coll):
            return {}

        key = self.make_key(user, coll, self.Q_KEY)
        urls = data.get('urls')
        if not urls or not isinstance(urls, list):
            return {}

        llen = self.redis.rpush(key, *urls)

        return {'num_added': len(urls),
                'q_len': llen}

    def get_from_queue(self, user, coll):
        if not self.can_write_coll(user, coll):
            return {}

        key = self.make_key(user, coll, self.Q_KEY)
        url = self.redis.lpop(key)
        llen = self.redis.llen(key)
        if not url:
            return {'q_len': 0}

        return {'url': url,
                'q_len': llen}

    def add_page(self, user, coll, pagedata):
        if not self.can_write_coll(user, coll):
            print('Cannot Write')
            return False

        url = pagedata['url']

        try:
            key, end_key = calc_search_range(url, 'exact')
        except:
            print('Cannot Canon')
            return False

        cdx_key = self.make_key(user, coll, self.CDX_KEY)
        print(cdx_key, key)
        result = self.redis.zrangebylex(cdx_key,
                                        '[' + key,
                                        '(' + end_key)
        if not result:
            print('NO CDX')
            return False

        last_cdx = CDXObject(result[-1])

        pagedata['ts'] = last_cdx['timestamp']

        self.redis.sadd(self.make_key(user, coll, self.PAGE_KEY), json.dumps(pagedata))

    def list_pages(self, user, coll):
        if not self.can_read_coll(user, coll):
            return []

        pagelist = self.redis.smembers(self.make_key(user, coll, self.PAGE_KEY))
        pagelist = map(json.loads, pagelist)
        return pagelist

    def list_warcs(self, user, coll):
        if not self.can_admin_coll(user, coll):
            return []

        archive_dir = self.path_router.get_archive_dir(user, coll)

        warcs = {}

        for fullpath, filename in iter_file_or_dir([archive_dir]):
            stats = os.stat(fullpath)
            res = {'size': long(stats.st_size),
                   'mtime': long(stats.st_mtime),
                   'name': filename}
            warcs[filename] = res

        donewarcs = self.redis.smembers(self.make_key(user, coll, self.DONE_WARC_KEY))
        for stats in donewarcs:
            res = json.loads(stats)
            filename = res['name']
            warcs[filename] = res

        return warcs.values()

    def download_warc(self, user, coll, name):
        if not self.can_admin_coll(user, coll):
            return None

        if not self.WARC_RX.match(name):
            return None

        warc_path = self.redis.hget(self.make_key(user, coll, self.WARC_KEY), name)
        if not warc_path:
            return None

        if not warc_path.startswith('s3://'):
            archive_dir = self.path_router.get_archive_dir(user, coll)
            full_path = os.path.join(archive_dir, name)
            if os.path.isfile(full_path):
                length = os.stat(full_path).st_size
                print('Local File')
                stream = open(full_path, 'r')
                return length, stream
            else:
                return None

        print('Remote File')
        result = self.remotemanager.download_stream(warc_path)
        return result

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
