import six
import time
import redis
import re
import json
import os
import base64

from datetime import datetime

from bottle import template, request, HTTPError

from webrecorder.webreccork import ValidationException
from webrecorder.redisutils import RedisTable
from cork import AAAException


# ============================================================================
class LoginManagerMixin(object):
    USER_RX = re.compile(r'^[A-Za-z0-9][\w-]{2,30}$')

    RESTRICTED_NAMES = ['login', 'logout', 'user', 'admin', 'manager',
                        'guest', 'settings', 'profile', 'api', 'anon',
                        'anonymous', 'register', 'join', 'download']

    PASS_RX = re.compile(r'^(?=.*[\d\W])(?=.*[a-z])(?=.*[A-Z]).{8,}$')

    USER_KEY = 'u:{user}'
    USER_SKIP_KEY = 'u:{user}:skip:{url}'

    def __init__(self, config):
        super(LoginManagerMixin, self).__init__(config)
        try:
            self.default_max_size = int(config['default_max_size'])
            self.default_max_anon_size = int(config['default_max_anon_size'])
            self.default_max_coll = int(config['default_max_coll'])

            if not self.redis.exists('h:defaults'):
                self.redis.hset('h:defaults', 'max_size', self.default_max_size)
                self.redis.hset('h:defaults', 'max_anon_size', self.default_max_anon_size)
                self.redis.hset('h:defaults', 'max_coll', self.default_max_coll)
        except Exception as e:
            print('WARNING: Unable to init defaults: ' + str(e))

    def create_user(self, reg):
        try:
            user = self.cork.validate_registration(reg)
        except AAAException as a:
            raise ValidationException(a)

        key = self.USER_KEY.format(user=user)
        now = int(time.time())

        max_size, max_coll = self.redis.hmget('h:defaults', ['max_size', 'max_coll'])
        if not max_size:
            max_size = self.default_max_size

        if not max_coll:
            max_coll = self.default_max_coll

        with redis.utils.pipeline(self.redis) as pi:
            pi.hset(key, 'max_size', max_size)
            pi.hset(key, 'max_coll', max_coll)
            pi.hset(key, 'created_at', now)
            pi.hsetnx(key, 'size', '0')

        self.cork.do_login(user)
        return user

    def _create_anon_user(self, user):
        max_size = self.redis.hget('h:defaults', 'max_anon_size')
        if not max_size:
            max_size = self.default_max_anon_size

        key = self.USER_KEY.format(user=user)
        now = int(time.time())

        with redis.utils.pipeline(self.redis) as pi:
            pi.hset(key, 'max_size', max_size)
            pi.hset(key, 'max_coll', 1)
            pi.hset(key, 'created_at', now)
            pi.hsetnx(key, 'size', '0')

    def get_user_info(self, user):
        key = self.USER_KEY.format(user=user)
        result = self._format_info(self.redis.hgetall(key))
        return result

    def has_user(self, user):
        return self.cork.user(user) is not None

    def get_anon_user(self, save_sesh=True):
        sesh = request.environ['webrec.session']
        if not sesh.is_anon() and save_sesh:
            sesh.set_anon()
            self._create_anon_user(sesh.anon_user)

        return sesh.anon_user

    def set_user_desc(self, user, desc):
        self.assert_user_is_owner(user)

        key = self.USER_KEY.format(user=user)

        self.redis.hset(key, 'desc', desc)

    def delete_user(self, user):
        if not self.is_anon(user):
            self.assert_user_is_owner(user)

        res = self._send_delete('user', user)
        if res and not self.is_anon(user):
            # delete from cork!
            self.cork.user(user).delete()

        return res

    def _send_delete(self, type_, user, coll='*', rec='*'):
        message = {'type': type_,
                   'user': user,
                   'coll': coll,
                   'rec': rec}

        res = self.redis.publish('delete', json.dumps(message))
        return (res > 0)

    def get_size_remaining(self, user):
        user_key = self.USER_KEY.format(user=user)

        size, max_size = self.redis.hmget(user_key, ['size', 'max_size'])

        try:
            if not size:
                size = 0

            if not max_size:
                max_size = self.default_max_size

            max_size = int(max_size)
            size = int(size)
            rem = max_size - size
        except Exception as e:
            print(e)

        return rem

    def is_out_of_space(self, user):
        if not user:
            user = self.get_anon_user(False)
        elif not self.is_owner(user):
            return False

        return self.get_size_remaining(user) <= 0

    def has_user_email(self, email):
        #TODO: implement a email table, if needed?
        all_users = RedisTable(self.redis, 'h:users')
        for n, userdata in all_users.items():
            if userdata['email_addr'] == email:
                return True

        return False

    def validate_user(self, user, email):
        if self.has_user(user):
            msg = 'User <b>{0}</b> already exists! Please choose a different username'
            msg = msg.format(user)
            raise ValidationException(msg)

        if not self.USER_RX.match(user) or user in self.RESTRICTED_NAMES:
            msg = 'The name <b>{0}</b> is not a valid username. Please choose a different username'
            msg = msg.format(user)
            raise ValidationException(msg)

        if self.has_user_email(email):
            msg = 'There is already an account for <b>{0}</b>. If you have trouble logging in, you may <a href="/_forgot"><b>reset the password</b></a>.'
            msg = msg.format(email)
            raise ValidationException(msg)

        return True

    def validate_password(self, password, confirm):
        if password != confirm:
            raise ValidationException('Passwords do not match!')

        if not self.PASS_RX.match(password):
            raise ValidationException('Please choose a different password')

        return True

    def update_password(self, curr_password, password, confirm):
        user = self.get_curr_user()
        if not self.cork.verify_password(user, curr_password):
            raise ValidationException('Incorrect Current Password')

        self.validate_password(password, confirm)

        self.cork.update_password(user, password)

    def is_valid_invite(self, invitekey):
        try:
            if not invitekey:
                return False

            key = base64.b64decode(invitekey.encode('utf-8')).decode('utf-8')
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

        hash_ = base64.b64encode(os.urandom(21)).decode('utf-8')
        entry['hash_'] = hash_

        full_hash = email + ':' + hash_
        invitekey = base64.b64encode(full_hash.encode('utf-8')).decode('utf-8')

        email_text = template(
            email_template,
            host=host,
            email_addr=email,
            name=entry.get('name', email),
            invite=invitekey,
        )
        self.cork.mailer.send_email(email, 'You are invited to join webrecorder.io beta!', email_text)
        entry['sent'] = str(datetime.utcnow())
        return True

    def report_issues(self, issues, ua=''):
        issues_dict = {}
        for key in issues.iterkeys():
            issues_dict[key] = issues[key]

        issues_dict['user'] = self.get_curr_user()
        issues_dict['time'] = str(datetime.utcnow())
        issues_dict['ua'] = ua
        report = json.dumps(issues_dict)

        self.redis.rpush('h:reports', report)

    def skip_post_req(self, user, url):
        key = self.USER_SKIP_KEY.format(user=user, url=url)
        self.redis.setex(key, 300, 1)


# ============================================================================
class AccessManagerMixin(object):
    READ_PREFIX = 'r:'
    WRITE_PREFIX = 'w:'
    PUBLIC = '@public'

    def is_anon(self, user):
        return not user or user == '@anon' or user.startswith('anon/')

    def get_curr_user(self):
        sesh = request.environ['webrec.session']
        return sesh.curr_user

    def _check_access(self, user, coll, type_prefix):
        # anon access
        if self.is_anon(user):
            return True

        sesh = request.environ['webrec.session']
        curr_user = sesh.curr_user
        curr_role = sesh.curr_role

        # current user always has access, if collection exists
        if user == curr_user:
            return self._has_collection_no_access_check(user, coll)

        key = self.COLL_INFO_KEY.format(user=user, coll=coll)

        #role_key = self.ROLE_KEY.format(role=curr_role)

        if not curr_user:
            res = self.redis.hmget(key, type_prefix + self.PUBLIC)
        else:
            res = self.redis.hmget(key, type_prefix + self.PUBLIC,
                                        type_prefix + curr_user)

        return any(res)

    def is_public(self, user, coll):
        key = self.COLL_INFO_KEY.format(user=user, coll=coll)
        res = self.redis.hget(key, self.READ_PREFIX + self.PUBLIC)
        return res == b'1'

    def set_public(self, user, coll, is_public):
        if not self.can_admin_coll(user, coll):
            return False

        key = self.COLL_INFO_KEY.format(user=user, coll=coll)

        if is_public:
            self.redis.hset(key, self.READ_PREFIX + self.PUBLIC, 1)
        else:
            self.redis.hdel(key, self.READ_PREFIX + self.PUBLIC)

        return True

    def can_read_coll(self, user, coll):
        return self._check_access(user, coll, self.READ_PREFIX)

    def can_write_coll(self, user, coll):
        return self._check_access(user, coll, self.WRITE_PREFIX)

    # for now, equivalent to is_owner(), but a different
    # permission, and may change
    def can_admin_coll(self, user, coll):
        if self.is_anon(user):
            return True

        return self.is_owner(user)

    def is_owner(self, user):
        curr_user = self.get_curr_user()
        if not curr_user:
            return self.is_anon(user)

        return (user and user == curr_user)

    def assert_user_exists(self, user):
        if not self.has_user(user):
            raise HTTPError(404, 'No Such User')

    def assert_logged_in(self):
        try:
            self.cork.require(role='archivist')
        except Exception:
            raise HTTPError(404, 'Not Logged In')

    def assert_user_is_owner(self, user):
        self.assert_logged_in()
        if self.is_owner(user):
            return True

        raise HTTPError(404, 'No Such User')

    def assert_can_read(self, user, coll):
        if not self.can_read_coll(user, coll):
            raise HTTPError(404, 'No Read Access')
            #raise ValidationException('No Read Access')

    def assert_can_write(self, user, coll):
        if not self.can_write_coll(user, coll):
            raise HTTPError(404, 'No Write Access')
            #raise ValidationException('No Write Access')

    def assert_can_admin(self, user, coll):
        if not self.is_anon(user):
            self.assert_logged_in()

        if not self.can_admin_coll(user, coll):
            raise HTTPError(404, 'No Admin Access')
            #raise ValidationException('No Admin Access')


# ============================================================================
class RecManagerMixin(object):
    def __init__(self, config):
        super(RecManagerMixin, self).__init__(config)
        self.REC_INFO_KEY = 'r:{user}:{coll}:{rec}:info'
        self.PAGE_KEY = 'r:{user}:{coll}:{rec}:page'
        self.INT_KEYS = ('size', 'created_at', 'updated_at')

    def get_recording(self, user, coll, rec):
        self.assert_can_read(user, coll)

        key = self.REC_INFO_KEY.format(user=user, coll=coll, rec=rec)
        result = self._format_info(self.redis.hgetall(key))
        return result

    def has_recording(self, user, coll, rec):
        #self.assert_can_read(user, coll)
        if not self.can_read_coll(user, coll):
            return False

        key = self.REC_INFO_KEY.format(user=user, coll=coll, rec=rec)
        #return self.redis.exists(key)
        return self.redis.hget(key, 'id') != None

    def create_recording(self, user, coll, rec, rec_title):
        self.assert_can_write(user, coll)

        key = self.REC_INFO_KEY.format(user=user, coll=coll, rec=rec)

        now = int(time.time())

        with redis.utils.pipeline(self.redis) as pi:
            pi.hset(key, 'id', rec)
            pi.hset(key, 'title', rec_title)
            pi.hset(key, 'created_at', now)
            pi.hset(key, 'updated_at', now)
            pi.hsetnx(key, 'size', '0')

        if not self._has_collection_no_access_check(user, coll):
            self.create_collection(user, coll)

        return self.get_recording(user, coll, rec)

    def get_recordings(self, user, coll):
        self.assert_can_read(user, coll)

        key_pattern = self.REC_INFO_KEY.format(user=user, coll=coll, rec='*')

        keys = list(self.redis.scan_iter(match=key_pattern))

        with redis.utils.pipeline(self.redis) as pi:
            for key in keys:
                pi.hgetall(key)

            all_recs = pi.execute()

        all_recs = [self._format_info(x) for x in all_recs]
        return all_recs

    def delete_recording(self, user, coll, rec):
        self.assert_can_admin(user, coll)

        return self._send_delete('rec', user, coll, rec)

    def add_page(self, user, coll, rec, pagedata):
        self.assert_can_write(user, coll)

        key = self.PAGE_KEY.format(user=user, coll=coll, rec=rec)

        pagedata_json = json.dumps(pagedata).encode('utf-8')

        #self.redis.sadd(key, pagedata_json)
        self.redis.hset(key, pagedata['url'], pagedata_json)

    def list_pages(self, user, coll, rec):
        self.assert_can_read(user, coll)

        key = self.PAGE_KEY.format(user=user, coll=coll, rec=rec)

        #pagelist = self.redis.smembers(key)
        pagelist = self.redis.hvals(key)

        pagelist = [json.loads(x.decode('utf-8')) for x in pagelist]

        return pagelist

    def num_pages(self, user, coll, rec):
        self.assert_can_read(user, coll)
        key = self.PAGE_KEY.format(user=user, coll=coll, rec=rec)
        return self.redis.hlen(key)


# ============================================================================
class CollManagerMixin(object):
    def __init__(self, config):
        super(CollManagerMixin, self).__init__(config)
        self.COLL_INFO_KEY = 'c:{user}:{coll}:info'

    def get_collection(self, user, coll):
        self.assert_can_read(user, coll)

        key = self.COLL_INFO_KEY.format(user=user, coll=coll)
        result = self._format_info(self.redis.hgetall(key))
        if result:
            result['recordings'] = self.get_recordings(user, coll)
        return result

    def _has_collection_no_access_check(self, user, coll):
        key = self.COLL_INFO_KEY.format(user=user, coll=coll)
        return self.redis.hget(key, 'id') != None

    def has_collection(self, user, coll):
        if not self.can_read_coll(user, coll):
            return False

        return self._has_collection_no_access_check(user, coll)

    def create_collection(self, user, coll, coll_title='', desc='', public=False):
        self.assert_can_admin(user, coll)

        key = self.COLL_INFO_KEY.format(user=user, coll=coll)
        coll_title = coll_title or coll

        now = int(time.time())

        with redis.utils.pipeline(self.redis) as pi:
            pi.hset(key, 'id', coll)
            pi.hset(key, 'title', coll_title)
            pi.hset(key, 'created_at', now)
            pi.hset(key, 'desc', desc)
            if public:
                pi.hset(key, self.READ_PREFIX + self.PUBLIC, 1)
            pi.hsetnx(key, 'size', '0')

        return self.get_collection(user, coll)

    def num_collections(self, user):
        key_pattern = self.COLL_INFO_KEY.format(user=user, coll='*')

        keys = list(self.redis.scan_iter(match=key_pattern))

        if not self.is_owner(user):
            keys = [key for key in keys if self.is_public(user, key.decode('utf-8'))]

        return len(keys)

    def get_collections(self, user):
        key_pattern = self.COLL_INFO_KEY.format(user=user, coll='*')

        keys = list(self.redis.scan_iter(match=key_pattern))

        with redis.utils.pipeline(self.redis) as pi:
            for key in keys:
                pi.hgetall(key)

            all_colls = pi.execute()

        all_colls = [self._format_info(x) for x in all_colls]

        if not self.is_owner(user):
            all_colls = [coll for coll in all_colls
                         if coll.get(self.READ_PREFIX + self.PUBLIC)]

        return all_colls

    def delete_collection(self, user, coll):
        if self.is_anon(user):
            return self.delete_user(user)

        self.assert_can_admin(user, coll)

        return self._send_delete('coll', user, coll)

    def set_coll_desc(self, user, coll, desc):
        self.assert_can_admin(user, coll)

        key = self.COLL_INFO_KEY.format(user=user, coll=coll)

        self.redis.hset(key, 'desc', desc)


# ============================================================================
class Base(object):
    def __init__(self, config):
        pass

    def get_content_inject_info(self, user, coll, rec):
        info = {}

        coll_key = self.COLL_INFO_KEY.format(user=user, coll=coll)

        # recording
        if rec != '*' and rec:
            rec_key = self.REC_INFO_KEY.format(user=user, coll=coll, rec=rec)
            info['rec_title'], info['size'] = self.redis.hmget(rec_key, ['title', 'size'])
            if info.get('rec_title'):
                info['rec_title'] = info['rec_title'].decode('utf-8')
            else:
                info['rec_title'] = rec
            info['rec_id'] = rec
        else:
            info['size'] = self.redis.hget(coll_key, 'size')

        # collection
        info['coll_id'] = coll
        info['coll_title'] = self.redis.hget(coll_key, 'title')

        if info.get('coll_title'):
            info['coll_title'] = info['coll_title'].decode('utf-8')
        else:
            info['coll_title'] = coll

        try:
            info['size'] = int(info['size'])
        except Exception as e:
            info['size'] = 0

        info['size_remaining'] = self.get_size_remaining(user)

        if self.is_anon(user):
            info['user'] = '@anon'
        else:
            info['user'] = user

        return info

    def _format_info(self, result):
        if not result:
            return {}

        result = self._conv_dict(result)
        result = self._to_int(result)
        return result

    def _to_int(self, result):
        for x in self.INT_KEYS:
            if x in result:
                result[x] = int(result[x])
        return result

    def _conv_dict(self, result):
        if six.PY2 or not result:
            return result

        return dict(((n.decode('utf-8'), v.decode('utf-8')
                    if isinstance(v, bytes) else v) for n, v in result.items()))


# ============================================================================
class RedisDataManager(AccessManagerMixin, LoginManagerMixin, RecManagerMixin, CollManagerMixin, Base):
    def __init__(self, redis, cork, browser_redis, config):
        self.redis = redis
        self.cork = cork
        self.browser_redis = browser_redis

        super(RedisDataManager, self).__init__(config)
