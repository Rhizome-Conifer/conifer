from datetime import timedelta
import os
import base64
import pickle

from webrecorder.cookieguard import CookieGuard
from itsdangerous import URLSafeTimedSerializer, BadSignature


# ============================================================================
class Session(object):
    def __init__(self, cork, anon_duration, key, sesh, ttl):
        self.anon_duration = anon_duration

        self.sesh = sesh
        self.key = key

        self.curr_user = None
        self.curr_role = None

        self.should_delete = False
        self.should_save = False

        self.ttl = ttl

        try:
            self._anon = self.sesh.get('anon')
            if self._anon:
                self.curr_role = 'anon'
            else:
                self.curr_user = self.sesh.get('username')
                if self.curr_user:
                    self.curr_role = cork.user(self.curr_user).role

        except Exception as e:
            print(e)
            self.curr_user = None
            self.curr_role = None
            self.should_delete = True

        message, msg_type = self.pop_message()

        params = {'curr_user': self.curr_user,
                  'curr_role': self.curr_role,
                  'message': message,
                  'msg_type': msg_type}

        self.template_params = params

    def save(self):
        self.should_save = True

    def __getitem__(self, name):
        return self.sesh[name]

    def __setitem__(self, name, value):
        self.sesh[name] = value

    def get(self, name, value=None):
        return self.sesh.get(name, value)

    def set_anon(self):
        if not self.curr_user:
            self.sesh['anon'] = self.anon_user

            #self.update_expires()
            self.save()

    def is_anon(self, user=None):
        if self.curr_user:
            return False

        anon = self.sesh.get('anon')
        if not anon:
            return False

        if user:
            return user == anon

        return True

    @property
    def anon_user(self):
        if self._anon:
            return self._anon

        self._anon = self.sesh.get('anon')
        if not self._anon:
            self._anon = self.make_anon_user()

        return self._anon

    def flash_message(self, msg, msg_type='danger'):
        if self.sesh:
            self.sesh['message'] = msg_type + ':' + msg
            self.save()
        else:
            print('No Message')

    def pop_message(self):
        msg_type = ''
        if not self.sesh:
            return '', msg_type

        message = self.sesh.get('message', '')
        if message:
            self.sesh['message'] = ''
            self.save()

        if ':' in message:
            msg_type, message = message.split(':', 1)

        return message, msg_type

    @staticmethod
    def make_anon_user():
        return 'temp!' + base64.b32encode(os.urandom(5)).decode('utf-8')


# ============================================================================
class RedisSessionMiddleware(CookieGuard):
    def __init__(self, app, cork, redis, session_opts):
        super(RedisSessionMiddleware, self).__init__(app, session_opts['session.key'])
        self.redis = redis
        self.cork = cork
        self.secret_key = session_opts['session.secret']
        self.key_template = session_opts['key_template']
        self.anon_duration = session_opts['session.expire']

    def init_session(self, environ):
        sesh_cookie = self.split_cookie(environ)

        data = None

        sesh_id = self.signed_cookie_to_id(sesh_cookie, self.anon_duration)

        if sesh_id:
            redis_key = self.key_template.format(sesh_id)

            data = self.redis.get(redis_key)
            if data:
                data = pickle.loads(base64.b64decode(data))
                ttl = self.redis.ttl(redis_key)

        # make new session
        if data is None:
            sesh_id = self.make_id()

            redis_key = self.key_template.format(sesh_id)

            data = {'id': sesh_id}

            ttl = -2

        session = Session(self.cork,
                          self.anon_duration,
                          redis_key,
                          data,
                          ttl)

        if session.curr_role == 'anon':
            session.template_params['anon_ttl'] = ttl

            anon_user = session.sesh['anon']
            self.redis.set('t:' + anon_user, sesh_id)

        environ['webrec.template_params'] = session.template_params
        environ['webrec.session'] = session

    def prepare_response(self, environ, headers):
        super(RedisSessionMiddleware, self).prepare_response(environ, headers)

        session = environ['webrec.session']

        if session.should_delete:
            self._delete_cookie(headers, self.sesh_key)
        else:
            if session.should_save:
                data = base64.b64encode(pickle.dumps(session.sesh))
                self.redis.set(session.key, data)

            if self.should_set_cookie(session):
                self.set_cookie_and_duration(session, headers)

    def should_set_cookie(self, session):
        # new or expired session, set if saving session
        if session.ttl < 0:
            return session.should_save

        # if anon, don't set again (allow expiry)
        if session.curr_role == 'anon':
            return False

        # if not anon, refresh is time is running out
        if session.ttl < 120:
            return True

    def set_cookie_and_duration(self, session, headers):
        sesh_cookie = self.id_to_signed_cookie(session.sesh['id'])

        value = '{0}={1}; Path=/; max-age={2}'.format(self.sesh_key,
                                              sesh_cookie,
                                              self.anon_duration)

        self.redis.expire(session.key, self.anon_duration)

        headers.append(('Set-Cookie', value))

    def signed_cookie_to_id(self, sesh_cookie, max_age):
        if not sesh_cookie:
            return None

        sesh_cookie = sesh_cookie.strip()
        if not sesh_cookie.startswith(self.sesh_key + '='):
            return None

        sesh_cookie = sesh_cookie[len(self.sesh_key) + 1:]

        serial = URLSafeTimedSerializer(self.secret_key)

        try:
            return serial.loads(sesh_cookie, max_age=max_age * 2)
        except BadSignature as b:
            return None

    def id_to_signed_cookie(self, sesh_id):
        return URLSafeTimedSerializer(self.secret_key).dumps(sesh_id)

    def make_id(self):
        return base64.b64encode(os.urandom(20)).decode('utf-8')
