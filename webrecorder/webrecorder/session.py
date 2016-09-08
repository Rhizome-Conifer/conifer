import os
from os.path import expandvars
from datetime import timedelta, datetime
from pywb.utils.timeutils import datetime_to_http_date

import base64
import pickle
import redis

from webrecorder.cookieguard import CookieGuard
from itsdangerous import URLSafeTimedSerializer, BadSignature


# ============================================================================
class Session(object):
    temp_prefix = ''

    def __init__(self, cork, environ, key, sesh, ttl, is_restricted):
        self.environ = environ
        self._sesh = sesh
        self.key = key

        self.curr_user = None
        self.curr_role = None

        self.should_delete = False
        self.should_save = False
        self.should_renew = False

        self.is_restricted = is_restricted

        if sesh.get('is_long'):
            self.dura_type = 'long'
        else:
            self.dura_type = 'short'

        self.ttl = ttl

        try:
            self._anon = self._sesh.get('anon')
            if self._anon:
                self.curr_role = 'anon'
            else:
                self.curr_user = self._sesh.get('username')
                if self.curr_user:
                    self.curr_role = cork.user(self.curr_user).role

        except Exception as e:
            print(e)
            self.curr_user = None
            self.curr_role = None
            self.delete()

        message, msg_type = self.pop_message()

        params = {'curr_user': self.curr_user,
                  'curr_role': self.curr_role,
                  'message': message,
                  'msg_type': msg_type}

        self.template_params = params

    def is_new(self):
        return self.ttl == -2

    def get_id(self):
        if self.is_new():
            self.save()

        return self._sesh['id']

    def set_id(self, id):
        self._sesh['id'] = id
        self.is_restricted = True
        self.save()

    def save(self):
        self.should_save = True

    def delete(self):
        self.should_delete = True
        self.environ['webrec.delete_all_cookies'] = 'all'

    def __getitem__(self, name):
        return self._sesh[name]

    def __setitem__(self, name, value):
        self._sesh[name] = value
        self.should_save = True

    def get(self, name, value=None):
        return self._sesh.get(name, value)

    def set_anon(self):
        if not self.curr_user:
            self['anon'] = self.anon_user

    def is_anon(self, user=None):
        if self.curr_user:
            return False

        anon = self._sesh.get('anon')
        if not anon:
            return False

        if user:
            return user == anon

        return True

    def logged_in(self, extend_long=False):
        if extend_long:
            self.dura_type = 'long'
            self._sesh['is_long'] = True

        self.should_renew = True
        self.should_save = True
        self.environ['webrec.delete_all_cookies'] = 'non_sesh'

    @property
    def anon_user(self):
        if self._anon:
            return self._anon

        self._anon = self._sesh.get('anon')
        if not self._anon:
            self._anon = self.make_anon_user()

        return self._anon

    def flash_message(self, msg, msg_type='danger'):
        self['message'] = msg_type + ':' + msg

    def pop_message(self):
        msg_type = ''
        if not self._sesh:
            return '', msg_type

        message = self.get('message', '')
        if message:
            self['message'] = ''

        if ':' in message:
            msg_type, message = message.split(':', 1)

        return message, msg_type

    @staticmethod
    def make_anon_user():
        return Session.temp_prefix + base64.b32encode(os.urandom(5)).decode('utf-8')


# ============================================================================
class RedisSessionMiddleware(CookieGuard):
    def __init__(self, app, cork, redis, session_opts):
        super(RedisSessionMiddleware, self).__init__(app, session_opts['session.key'])
        self.redis = redis
        self.cork = cork

        self.secret_key = expandvars(session_opts['session.secret'])

        self.key_template = session_opts['session.key_template']
        self.long_sessions_key = session_opts['session.long_sessions_key']

        self.durations = session_opts['session.durations']

    def init_session(self, environ):
        data = None
        ttl = -2
        is_restricted = False

        try:
            sesh_cookie = self.split_cookie(environ)

            sesh_id, is_restricted = self.signed_cookie_to_id(sesh_cookie)

            if sesh_id:
                redis_key = self.key_template.format(sesh_id)

                result = self.redis.get(redis_key)
                if result:
                    data = pickle.loads(base64.b64decode(result))
                    ttl = self.redis.ttl(redis_key)
        except Exception as e:
            import traceback
            traceback.print_exc()
            print('Invalid Session, Creating New')

        # make new session
        if data is None:
            sesh_id, redis_key = self.make_id()

            data = {'id': sesh_id}

        session = Session(self.cork,
                          environ,
                          redis_key,
                          data,
                          ttl,
                          is_restricted)

        if session.curr_role == 'anon':
            session.template_params['anon_ttl'] = ttl

            anon_user = session['anon']
            self.redis.set('t:' + anon_user, sesh_id)

        environ['webrec.template_params'] = session.template_params
        environ['webrec.session'] = session

    def prepare_response(self, environ, headers):
        super(RedisSessionMiddleware, self).prepare_response(environ, headers)

        session = environ['webrec.session']

        if session.should_delete:
            self._delete_cookie(headers, self.sesh_key)
            self.redis.delete(session.key)
        else:
            if session.should_renew:
                self.redis.delete(session.key)
                sesh_id, session.key = self.make_id()
                session['id'] = sesh_id

            set_cookie = self.should_set_cookie(session)

            if set_cookie or session.should_save:
                with redis.utils.pipeline(self.redis) as pi:
                    self._update_redis_and_cookie(pi, set_cookie, session, headers)

    def should_set_cookie(self, session):
        # new or expired session, set if saving session
        if session.ttl < 0:
            return session.should_save

        # renewing, save!
        if session.should_renew:
            return True

        # if anon, don't set again (allow expiry)
        if session.curr_role == 'anon':
            return False

        # if not anon, refresh is time is running out
        if session.ttl < self.durations[session.dura_type]['extend']:
            return True

        return False

    def _update_redis_and_cookie(self, pi, set_cookie, session, headers):
        duration = self.durations[session.dura_type]['total']

        if session.should_save:
            data = base64.b64encode(pickle.dumps(session._sesh))

            ttl = session.ttl
            if ttl < 0:
                ttl = duration

            pi.setex(session.key, ttl, data)

        if not set_cookie:
            return

        self.track_long_term(session)

        expires = datetime.utcnow() + timedelta(seconds=duration)

        # set redis duration
        pi.expire(session.key, duration)

        # set cookie
        sesh_cookie = self.id_to_signed_cookie(session['id'],
                                               session.is_restricted)

        value = '{0}={1}; Path=/; HttpOnly; max-age={3}'
        value = value.format(self.sesh_key,
                             sesh_cookie,
                             datetime_to_http_date(expires),
                             duration)

        scheme = session.environ.get('wsgi.url_scheme', '')
        if scheme.lower() == 'https':
            value += '; Secure'

        headers.append(('Set-Cookie', value))

    def track_long_term(self, session):
        if session.dura_type != 'long':
            return

        username = session.get('username')

        # ensure username is present if setting long term session!
        if not username:
            session.dura_type = 'short'
            session['is_long'] = False
            return

        self.redis.lpush(self.long_sessions_key.format(username), session.key)

    def clear_long_term(self, username):
        list_key = self.long_sessions_key.format(username)

        long_sesh_keys = self.redis.lrange(list_key, 0, -1)

        with redis.utils.pipeline(self.redis) as pi:
            for key in long_sesh_keys:
                pi.delete(key)

            pi.delete(list_key)

    def signed_cookie_to_id(self, sesh_cookie):
        if not sesh_cookie:
            return None

        sesh_cookie = sesh_cookie.strip()
        if not sesh_cookie.startswith(self.sesh_key + '='):
            return None

        sesh_cookie = sesh_cookie[len(self.sesh_key) + 1:]

        serial = URLSafeTimedSerializer(self.secret_key)

        try:
            return serial.loads(sesh_cookie)
        except BadSignature as b:
            return None

    def id_to_signed_cookie(self, sesh_id, is_restricted):
        return URLSafeTimedSerializer(self.secret_key).dumps([sesh_id, is_restricted])

    def make_id(self):
        sesh_id = base64.b64encode(os.urandom(20)).decode('utf-8')
        redis_key = self.key_template.format(sesh_id)

        return sesh_id, redis_key


