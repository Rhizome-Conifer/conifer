from bottle import template, request
from cork import Cork, AAAException
from beaker.middleware import SessionMiddleware
from cork.json_backend import JsonBackend
from redis import StrictRedis, utils

import json
import os
import re
import base64
import shutil

from datetime import datetime
from urlparse import urlsplit

from pywb.manager.manager import CollectionsManager, main as manager_main
from pywb.utils.canonicalize import calc_search_range

from cookieguard import CookieGuard

from pywb.warc.cdxindexer import iter_file_or_dir
from pywb.cdx.cdxobject import CDXObject
from pywb.utils.loaders import load_yaml_config

from redisutils import RedisTable, RedisCorkBackend


# ============================================================================
class CustomCork(Cork):
    def verify_password(self, username, password):
        salted_hash = self._store.users[username]['hash']
        if hasattr(salted_hash, 'encode'):
            salted_hash = salted_hash.encode('ascii')
        authenticated = self._verify_password(
            username,
            password,
            salted_hash,
        )
        return authenticated

    def update_password(self, username, password):
        user = self.user(username)
        if user is None:
            raise AAAException("Nonexistent user.")
        user.update(pwd=password)

    def do_login(self, username):
        self._setup_cookie(username)
        self._store.users[username]['last_login'] = str(datetime.utcnow())
        self._store.save_users()

    def validate_registration(self, registration_code):
        """Validate pending account registration, create a new account if
        successful.
        :param registration_code: registration code
        :type registration_code: str.
        """
        try:
            data = self._store.pending_registrations.pop(registration_code)
        except KeyError:
            raise AuthException("Invalid registration code.")

        username = data['username']
        if username in self._store.users:
            raise AAAException("User is already existing.")

        # the user data is moved from pending_registrations to _users
        self._store.users[username] = {
            'role': data['role'],
            'hash': data['hash'],
            'email_addr': data['email_addr'],
            'desc': data['desc'],
            'creation_date': data['creation_date'],
            'last_login': str(datetime.utcnow())
        }
        self._store.save_users()
        return username

    def _save_session(self):
        self._beaker_session['anon'] = None
        self._beaker_session.save()


def create_cork(redis, config):
    backend=RedisCorkBackend(redis)
    init_cork_backend(backend)

    email_sender = os.path.expandvars(config.get('email_sender', ''))
    smtp_url = os.path.expandvars(config.get('email_smtp_url', ''))

    cork = CustomCork(backend=backend,
                email_sender=email_sender,
                smtp_url=smtp_url)
    return cork

def init_manager_for_invite(configfile='config.yaml'):
    config = load_yaml_config(configfile)

    redis_url = os.path.expandvars(config['redis_url'])

    redis_obj = StrictRedis.from_url(redis_url)

    cork = create_cork(redis_obj, config)

    manager = CollsManager(cork, redis_obj, None, None, None)
    return manager

def _get_crypt_key(key, config):
    val = config.get(key)
    if not val:
        val = base64.b64encode(os.urandom(33))
    return val


def init_cork(app, redis, config):
    cork = create_cork(redis, config)

    session_opts = config.get('session_opts')

    for n, v in session_opts.iteritems():
        if isinstance(v, str):
            session_opts[n] = os.path.expandvars(v)

    # url for redis
    url = session_opts.get('session.url')
    if url:
        parts = urlsplit(url)
        if parts.netloc:
            session_opts['session.url'] = parts.netloc
        #session_opts['session.db'] = 0

    app = CookieGuard(app, session_opts['session.key'])
    app = SessionMiddleware(app, session_opts)

    return app, cork


class ValidationException(Exception):
    pass


# ============================================================================
class CollsManager(object):
    COLL_KEY = ':<colls>'

    PUBLIC = '@public'
    GROUP = 'g:'

    WRITE_KEY = ':w'
    READ_KEY = ':r'
    PAGE_KEY = ':p'
    Q_KEY = ':q'

    DEDUP_KEY = ':d'
    SKIP_REQ_KEY = ':x:'
    CDX_KEY = ':cdxj'
    WARC_KEY = ':warc'
    DONE_WARC_KEY = ':warc:done'

    ALL_KEYS = [WRITE_KEY, READ_KEY, PAGE_KEY, Q_KEY,
                DEDUP_KEY, CDX_KEY, WARC_KEY, DONE_WARC_KEY]

    USER_RX = re.compile(r'^[A-Za-z0-9][\w-]{2,15}$')
    RESTRICTED_NAMES = ['login', 'logout', 'user', 'admin', 'manager', 'guest', 'settings', 'profile']
    PASS_RX = re.compile(r'^(?=.*[\d\W])(?=.*[a-z])(?=.*[A-Z]).{8,}$')
    WARC_RX = re.compile(r'^[\w.-]+$')

    def __init__(self, cork, redis, path_router, storage_manager, signer):
        self.cork = cork
        self.redis = redis
        self.path_router = path_router
        self.storage_manager = storage_manager
        self.signer = signer

    def make_key(self, user, coll, type_=''):
        return user + ':' + coll + type_

    #def curr_user_role(self):
    #    try:
    #        if self.cork.user_is_anonymous:
    #            return '', ''

    #        cu = self.cork.current_user
    #        return cu.username, cu.role
    #    except:
    #        return '', ''

    def get_curr_user(self):
        sesh = request.environ.get('webrec.session')
        if not sesh:
            return ''

        return sesh.curr_user

    def get_anon_user(self):
        sesh = request.environ.get('webrec.session')
        if not sesh:
            return ''

        return sesh.anon_user

    def _check_access(self, user, coll, type_):
        sesh = request.environ.get('webrec.session')
        if not sesh:
            curr_user = ''
            curr_role = ''
        else:
            curr_user = sesh.curr_user
            curr_role = sesh.curr_role

        # anon access
        if not curr_user and coll == '@anon':
            return True

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
        if coll == '@anon':
            return True

        if user is None:
            user = ''

        return self._check_access(user, coll, self.READ_KEY)

    def can_write_coll(self, user, coll):
        if coll == '@anon':
            return True

        if user is None:
            user = ''

        return self._check_access(user, coll, self.WRITE_KEY)

    # for now, equivalent to is_owner(), but a different
    # permission, and may change
    def can_admin_coll(self, user, coll):
        if coll == '@anon':
            return True

        return self.is_owner(user)

    def is_owner(self, user):
        curr_user = self.get_curr_user()
        return (user and user == curr_user)

    def has_user(self, user):
        return self.cork.user(user) is not None

    def _user_key(self, user):
        return 'u:' + user

    def init_user(self, reg):
        user = self.cork.validate_registration(reg)

        all_users = RedisTable(self.redis, 'h:users')
        usertable = all_users[user]

        max_len, max_coll = self.redis.hmget('h:defaults', ['max_len', 'max_coll'])
        if not max_len:
            max_len = 100000000

        if not max_coll:
            max_coll = 10

        usertable['max_len'] = max_len
        usertable['max_coll'] = max_coll

        key = self._user_key(user)
        self.redis.hset(key, 'max_len', max_len)
        self.redis.hset(key, 'max_coll', max_coll)

        self.cork.do_login(user)
        return user

    def has_space(self, user):
        sizes = self.redis.hmget(self._user_key(user), 'total_len', 'max_len')
        curr = sizes[0] or 0
        total = sizes[1] or 500000000

        return long(curr) <= long(total)

    def has_more_colls(self):
        user = self.get_curr_user()
        key = self._user_key(user)
        max_coll = self.redis.hget(key, 'max_coll')
        if not max_coll:
            max_coll = 10
        num_coll = self.redis.hlen(key + self.COLL_KEY)
        if int(num_coll) < int(max_coll):
            return True
        else:
            msg = 'You have reached the <b>{0}</b> collection limit.'.format(max_coll)
            msg += ' Check your account settings for upgrade options.'
            raise ValidationException(msg)

    def _get_user_colls(self, user):
        return RedisTable(self.redis, self._user_key(user) + self.COLL_KEY)

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

    def delete_invite(self, email):
        table = RedisTable(self.redis, 'h:invites')
        try:
            archive_invites = RedisTable(self.redis, 'h:arc_invites')
            archive_invites[email] = table[email]
        except:
            pass
        del table[email]

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
            print('No Such Email In Invite List')
            return False

        hash_ = base64.b64encode(os.urandom(21))
        entry['hash_'] = hash_

        invitekey = base64.b64encode(email + ':' + hash_)

        email_text = template(
            email_template,
            host=host,
            email_addr=email,
            name=entry.get('name', email),
            invite=invitekey,
        )
        self.cork.mailer.send_email(email, 'You are invited to join beta.webrecorder.io!', email_text)
        entry['sent'] = str(datetime.utcnow())
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

    def get_user_metadata(self, user, field):
        user_key = self._user_key(user)
        return self.redis.hget(user_key, field)

    def set_user_metadata(self, user, field, value):
        if not self.is_owner(user):
            return False

        user_key = self._user_key(user)
        self.redis.hset(user_key, field, value)
        return True

    def add_collection(self, user, coll, title, access):
        curr_user = self.get_curr_user()

        if not self.USER_RX.match(coll):
            raise ValidationException('Invalid Collection Name')

        if curr_user != user:
            raise ValidationException('Only {0} can create this collection!'.format(curr_user))

        if self.has_collection(user, coll):
            raise ValidationException('Collection {0} already exists!'.format(coll))

        dir_ = self.path_router.get_archive_dir(user, coll)
        if os.path.isdir(dir_):
            raise ValidationException('Collection {0} already exists!'.format(coll))

        os.makedirs(dir_)

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
                v['size'] = self.get_info(user, n).get('total_size')
                v['public'] = self.is_public(user, n)

        return colls

    def delete_collection(self, user, coll):
        if not self.can_admin_coll(user, coll):
            return False

        base_key = self.make_key(user, coll)
        keys = map(lambda x: base_key + x, self.ALL_KEYS)
        #key_q = '*' + user + ':' + coll + '*'
        #keys = self.redis.keys(key_q)

        coll_len = self.redis.hget(base_key + self.DEDUP_KEY, 'total_len')
        user_key = self._user_key(user)
        user_len = self.redis.hget(user_key, 'total_len')

        with utils.pipeline(self.redis) as pi:
            if coll_len:
                pi.hset(user_key, 'total_len', int(user_len) - int(coll_len))

            # delete all coll keys
            if keys:
                pi.delete(*keys)

            # send delete msg
            pi.publish('delete_coll', self.path_router.get_archive_dir(user, coll))

        # coll directory
        coll_dir = self.path_router.get_coll_root(user, coll)
        rel_dir = os.path.relpath(coll_dir, self.path_router.root_dir) + '/'

        # delete from remote storage
        self.storage_manager.delete_dir(rel_dir)

        # delete collection entry
        del self._get_user_colls(user)[coll]

        return True

    def delete_user(self, user):
        if not self.is_owner(user):
            return False

        colls_table = self._get_user_colls(user)
        for coll in colls_table:
            self.delete_collection(user, coll)

        # user directory
        user_dir = self.path_router.get_user_account_root(user)
        rel_dir = os.path.relpath(user_dir, self.path_router.root_dir) + '/'

        # delete from remote storage
        self.storage_manager.delete_dir(rel_dir)

        user_key = self._user_key(user)

        with utils.pipeline(self.redis) as pi:
            pi.delete(user_key)
            pi.delete(user_key + self.COLL_KEY)

            pi.publish('delete_user', user_dir)

        # delete from cork!
        self.cork.user(user).delete()
        return True

    def delete_anon_user(self, user):
        self.delete_collection(user, '@anon')

        user_dir = self.path_router.get_user_account_root(user)
        user_key = self._user_key(user)

        with utils.pipeline(self.redis) as pi:
            pi.delete(user_key)
            pi.delete(user_key + self.COLL_KEY)

            pi.publish('delete_user', user_dir)

        return True

    def get_user_info(self, user):
        if not self.is_owner(user):
            return {}

        user_key = self._user_key(user)
        user_res = self.redis.hmget(user_key, ['total_len', 'max_len', 'max_coll'])
        num_coll = self.redis.hlen(user_key + self.COLL_KEY)

        return {'user_total_size': user_res[0],
                'user_max_size': user_res[1],
                'max_coll': user_res[2],
                'num_coll': num_coll,
               }

    def get_info(self, user, coll):
        if not self.can_read_coll(user, coll):
            return {}

        key = self.make_key(user, coll, self.DEDUP_KEY)
        res = self.redis.hmget(key, ['total_len', 'num_urls'])

        user_key = self._user_key(user)
        user_res = self.redis.hmget(user_key, ['total_len', 'max_len'])

        return {'total_size': res[0],
                'num_urls': res[1],
                'user_total_size': user_res[0],
                'user_max_size': user_res[1]
               }
                #'pages': num_pages}

    def skip_post_req(self, user, url):
        key = self._user_key(user) + self.SKIP_REQ_KEY + url
        self.redis.setex(key, 300, 1)

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

        if 'ts' not in pagedata:
            cdx_key = self.make_key(user, coll, self.CDX_KEY)
            result = self.redis.zrangebylex(cdx_key,
                                            '[' + key,
                                            '(' + end_key)
            if not result:
                print('NO CDX')
                return False

            last_cdx = CDXObject(result[-1])

            pagedata['ts'] = last_cdx['timestamp']

        pagedata_json = json.dumps(pagedata)

        key = self.make_key(user, coll, self.PAGE_KEY)

        self.redis.sadd(key, pagedata_json)

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

	if os.path.isdir(archive_dir):
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

        # check if local path (TODO: better check?)
        if warc_path.startswith(('/', 'file://')):
            archive_dir = self.path_router.get_archive_dir(user, coll)
            full_path = os.path.join(archive_dir, name)
            if os.path.isfile(full_path):
                if self.signer and not self.signer.verify(full_path):
                    self.signer.sign(full_path)
                length = os.stat(full_path).st_size
                stream = open(full_path, 'r')
                return length, stream
            else:
                return None

        print('Remote File')
        result = self.storage_manager.download_stream(warc_path)
        return result

    def update_password(self, curr_password, password, confirm):
        user = self.get_curr_user()
        if not self.cork.verify_password(user, curr_password):
            raise ValidationException('Incorrect Current Password')

        self.validate_password(password, confirm)

        self.cork.update_password(user, password)

    def report_issues(self, issues, ua=''):
        issues_dict = {}
        for key in issues.iterkeys():
            issues_dict[key] = issues[key]

        issues_dict['user'] = self.get_curr_user()
        issues_dict['time'] = str(datetime.utcnow())
        issues_dict['ua'] = ua
        report = json.dumps(issues_dict)

        self.redis.rpush('h:reports', report)


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
    init_cork_backend(RedisCorkBackend(StrictRedis.from_url('redis://127.0.0.1:6379/1')))
