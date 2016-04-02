import six
import time
import redis
import re

from bottle import template

from webrecorder.webreccork import ValidationException
from webrecorder.redisutils import RedisTable
from cork import AAAException


# ============================================================================
class LoginManagerMixin(object):
    USER_RX = re.compile(r'^[A-Za-z0-9][\w-]{2,30}$')

    RESTRICTED_NAMES = ['login', 'logout', 'user', 'admin', 'manager',
                        'guest', 'settings', 'profile', 'api']

    PASS_RX = re.compile(r'^(?=.*[\d\W])(?=.*[a-z])(?=.*[A-Z]).{8,}$')

    USER_KEY = 'u:{user}'

    def __init__(self, config):
        super(LoginManagerMixin, self).__init__(config)
        try:
            if not self.redis.exists('h:defaults'):
                self.redis.hset('h:defaults', 'max_len', config['default_max_size'])
                self.redis.hset('h:defaults', 'max_anon_len', config['default_max_anon_size'])
                self.redis.hset('h:defaults', 'max_coll', config['default_max_coll'])
        except Exception as e:
            print('WARNING: Unable to init defaults: ' + str(e))

    def create_user(self, reg):
        try:
            user = self.cork.validate_registration(reg)
        except AAAException as a:
            raise ValidationException(a)

        key = self.USER_KEY.format(user=user)

        max_len, max_coll = self.redis.hmget('h:defaults', ['max_len', 'max_coll'])
        if not max_len:
            max_len = 100000000

        if not max_coll:
            max_coll = 10

        with redis.utils.pipeline(self.redis) as pi:
            pi.hset(key, 'max_len', max_len)
            pi.hset(key, 'max_coll', max_coll)
            pi.hset(key, 'created_at', now)
            pi.hset(key, 'total_len', '0')

        self.cork.do_login(user)
        return user
        #return self.get_recording(user, coll, rec)

    def has_user(self, user):
        return self.cork.user(user) is not None

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

    def is_valid_invite(self, invitekey):
        try:
            if not invitekey:
                return False

            key = base64.b64decode(invitekey.encode('utf-8'))
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


# ============================================================================
class RecManagerMixin(object):
    def __init__(self, config):
        super(RecManagerMixin, self).__init__(config)
        self.REC_INFO_KEY = 'r:{user}:{coll}:{rec}:info'

    def get_recording(self, user, coll, rec):
        key = self.REC_INFO_KEY.format(user=user, coll=coll, rec=rec)
        result = self._format_rec_info(self.redis.hgetall(key))
        return result

    def has_recording(self, user, coll, rec):
        key = self.REC_INFO_KEY.format(user=user, coll=coll, rec=rec)
        return self.redis.exists(key)

    def create_recording(self, user, coll, rec, rec_title):
        key = self.REC_INFO_KEY.format(user=user, coll=coll, rec=rec)

        now = int(time.time())

        with redis.utils.pipeline(self.redis) as pi:
            pi.hset(key, 'id', rec)
            pi.hset(key, 'title', rec_title)
            pi.hset(key, 'created_at', now)
            pi.hset(key, 'updated_at', now)
            pi.hset(key, 'size', '0')

        return self.get_recording(user, coll, rec)

    def get_recordings(self, user, coll):
        key_pattern = self.REC_INFO_KEY.format(user=user, coll=coll, rec='*')

        keys = list(self.redis.scan_iter(match=key_pattern))

        with redis.utils.pipeline(self.redis) as pi:
            for key in keys:
                pi.hgetall(key)

            all_recs = pi.execute()

        all_recs = [self._format_rec_info(x) for x in all_recs]
        return all_recs

    def _format_rec_info(self, result):
        if not result:
            return {}

        result = self._conv_dict(result)
        result = self._to_int(result, ['size', 'created_at', 'updated_at'])
        #result['id'] = id
        return result

    def _to_int(self, result, ints):
        for x in ints:
            result[x] = int(result[x])
        return result

    def _conv_dict(self, result):
        if six.PY2 or not result:
            return result

        return dict(((n.decode('utf-8'), v.decode('utf-8')) for n, v in result.items()))


# ============================================================================
class Base(object):
    def __init__(self, config):
        pass


# ============================================================================
class RedisDataManager(LoginManagerMixin, RecManagerMixin, Base):
    def __init__(self, redis, cork, config):
        self.redis = redis
        self.cork = cork

        super(RedisDataManager, self).__init__(config)
