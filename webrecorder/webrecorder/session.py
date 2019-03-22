import os
from os.path import expandvars
from datetime import timedelta, datetime

from warcio.timeutils import datetime_to_http_date

import base64
import pickle
import redis
from time import strftime, gmtime

from webrecorder.cookieguard import CookieGuard
from webrecorder.utils import redis_pipeline
from itsdangerous import URLSafeTimedSerializer, BadSignature


# ============================================================================
class Session(object):
    TEMP_KEY = 't:{0}'
    temp_prefix = ''

    def __init__(self, cork, environ, redis, key, sesh, ttl, is_restricted, sesh_manager):
        self.environ = environ
        self._sesh = sesh
        self.redis = redis
        self.key = key
        self.sesh_manager = sesh_manager

        self.curr_role = None

        self.should_delete = False
        self.should_save = False
        self.should_renew = False
        self.should_copy_cookie = False

        self.is_restricted = is_restricted

        if self.is_restricted:
            self.dura_type = 'restricted'
        elif sesh.get('is_long'):
            self.dura_type = 'long'
        else:
            self.dura_type = 'short'

        self.ttl = ttl

        try:
            self._anon = self._sesh.get('anon')
            if self._anon:
                self.curr_role = 'anon'
            else:
                if self.curr_user:
                    self.curr_role = cork.user(self.curr_user).role

                if self.curr_role == 'public-archivist':
                    self.is_restricted = True

        except Exception as e:
            print(e)
            self.curr_role = None
            self.delete()

        message, msg_type = self.pop_message()

        # TODO: remove template params as not used with frontend?
        params = {'curr_user': self.curr_user,
                  'curr_role': self.curr_role,
                  #'csrf': self.get_csrf(),
                  'message': message,
                  'msg_type': msg_type,
                 }

        if self.curr_role == 'anon':
            params['anon_ttl'] = ttl

        if sesh_manager.auto_login_user:
            params['auto_login'] = True

        self.template_params = params

    def is_new(self):
        if self.ttl == -2:
            return True

        return 'username' not in self._sesh and 'anon' not in self._sesh

    def get_id(self):
        if self.is_new():
            self.save()

        return self._sesh['id']

    #def get_csrf(self):
    #    return self._sesh.get('csrf', '')

    def set_id_from_cookie(self, cookie):
        if not cookie:
            return

        result = self.sesh_manager.signed_cookie_to_id(cookie)
        if not result:
            return

        sesh_id, is_restricted = result
        self.set_id(sesh_id)

    def is_same_session(self, cookie):
        if not cookie:
            return False

        result = self.sesh_manager.signed_cookie_to_id(cookie)
        if not result:
            return False

        sesh_id, is_restricted = result
        return self._sesh['id'] == sesh_id

    def set_id(self, id):
        self._sesh['id'] = id
        self.is_restricted = True
        self.dura_type = 'restricted'
        self.ttl = -2
        self.should_copy_cookie = True
        self.should_save = False

    def get_cookie(self):
        return self.sesh_manager.id_to_signed_cookie(self._sesh['id'],
                                                     self.is_restricted)

    def save(self):
        self.should_save = True

    def delete(self):
        self.should_delete = True
        self.environ['webrec.delete_all_cookies'] = 'all'
        self.redis.delete(self.key)

    def __getitem__(self, name):
        return self._sesh[name]

    def __setitem__(self, name, value):
        self._sesh[name] = value
        self.should_save = True

    def get(self, name, value=None):
        return self._sesh.get(name, value)

    def set_anon(self):
        if self.curr_user:
            return

        self['anon'] = self.anon_user

        self.curr_role = 'anon'

        self.redis.set(self.TEMP_KEY.format(self.anon_user), self._sesh['id'])

    def is_anon(self, user=None):
        anon = self._sesh.get('anon')
        if not anon:
            return False

        if self._sesh.get('username'):
            return False

        if user:
            return user == anon

        return True

    def set_anon_commit_wait(self):
        anon = self._sesh.get('anon')
        if anon:
            self.redis.set(self.TEMP_KEY.format(anon), 'commit-wait')

    @property
    def curr_user(self):
        if 'anon' in self._sesh:
            return None

        return self._sesh.get('username')

    def log_in(self, username, extend_long=False):
        if extend_long:
            self.dura_type = 'long'
            self._sesh['is_long'] = True

        self._sesh.pop('anon', '')
        self._sesh['username'] = username

        self.should_renew = True
        self.should_save = True

        self.environ['webrec.delete_all_cookies'] = 'non_sesh'
        self.redis.delete(self.key)

    def set_restricted_user(self, user):
        if not self.is_new():
            return

        if user.startswith(self.temp_prefix):
            self._sesh['anon'] = user
            self._anon = user
            self.curr_role = 'anon'
        else:
            self._sesh['username'] = user
            self.curr_role = 'archivist'

        self.should_save = False
        self.should_renew = False

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
    def __init__(self, app, cork, redis, session_opts, access_cls=None, access_redis=None):
        super(RedisSessionMiddleware, self).__init__(app, session_opts['session.key'])
        self.redis = redis
        self.access_redis = access_redis
        self.cork = cork

        self.auto_login_user = os.environ.get('AUTO_LOGIN_USER')

        self.secret_key = expandvars(session_opts['session.secret'])

        self.key_template = session_opts['session.key_template']
        self.long_sessions_key = session_opts['session.long_sessions_key']

        self.durations = session_opts['session.durations']

        self.access_cls = access_cls

    def _load_session(self, environ):
        sesh_cookie = self.split_cookie(environ)

        if not sesh_cookie:
            return

        sesh_cookie = sesh_cookie.strip()
        if not sesh_cookie.startswith(self.sesh_key + '='):
            return

        sesh_cookie = sesh_cookie[len(self.sesh_key) + 1:]

        environ['webrec.sesh_cookie'] = sesh_cookie

        result = self.signed_cookie_to_id(sesh_cookie)

        if not result:
            return

        sesh_id, is_restricted = result
        redis_key = self.key_template.format(sesh_id)

        result = self.redis.get(redis_key)
        if not result:
            return

        data = pickle.loads(base64.b64decode(result))
        ttl = self.redis.ttl(redis_key)

        return sesh_id, redis_key, data, ttl, is_restricted

    def init_session(self, environ):
        sesh_id = None
        redis_key = None
        data = None
        ttl = -2
        is_restricted = False

        if 'wsgiprox.proxy_host' not in environ:
            try:
                result = self._load_session(environ)
                if result:
                    sesh_id, redis_key, data, ttl, is_restricted = result
            except Exception as e:
                import traceback
                traceback.print_exc()
                print('Invalid Session, Creating New')

        # make new session
        if data is None:
            sesh_id, redis_key = self.make_id_and_key()

            data = {'id': sesh_id,
                    #'csrf': self.make_id()
                   }

            # auto-login as designated user for each new session
            if self.auto_login_user:
                data['username'] = self.auto_login_user

        session = Session(self.cork,
                          environ,
                          self.redis,
                          redis_key,
                          data,
                          ttl,
                          is_restricted,
                          self)

        environ['webrec.template_params'] = session.template_params
        environ['webrec.session'] = session
        if self.access_cls:
            environ['webrec.access'] = self.access_cls(session=session,
                                                       redis=self.access_redis)

    def prepare_response(self, environ, headers):
        if 'wsgiprox.proxy_host' in environ:
            return

        super(RedisSessionMiddleware, self).prepare_response(environ, headers)

        session = environ['webrec.session']

        if session.should_delete:
            self._delete_session_cookie(environ, headers, self.sesh_key)
        else:
            if session.should_renew:
                sesh_id, session.key = self.make_id_and_key()
                session['id'] = sesh_id

            set_cookie = self.should_set_cookie(session)

            if set_cookie or session.should_save:
                self._update_redis_and_cookie(set_cookie, session, headers)

    def should_set_cookie(self, session):
        if session.should_copy_cookie:
            return True

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

    def _update_redis_and_cookie(self, set_cookie, session, headers):
        duration = self.durations[session.dura_type]['total']

        if session.should_save:
            with redis_pipeline(self.redis) as pi:
                data = base64.b64encode(pickle.dumps(session._sesh))

                ttl = session.ttl
                if ttl < 0:
                    ttl = duration

                pi.setex(session.key, ttl, data)

                if set_cookie:
                    self.track_long_term(session, pi)

                # set redis duration
                if not session.is_restricted:
                    pi.expire(session.key, duration)

        elif set_cookie and not session.is_restricted:
            # extend redis duration if extending cookie!
            self.redis.expire(session.key, duration)

        if not set_cookie:
            return

        expires = datetime.utcnow() + timedelta(seconds=duration)

        # set cookie
        sesh_cookie = session.get_cookie()

        value = '{0}={1}; Path=/; HttpOnly'

        # add max-age only if:
        # - long duration session
        # - anonymous session (not restricted)
        # don't set for restricted session, as cookie only valid as long as top session exists
        if session.dura_type == 'long' or session.curr_role == 'anon':
            value += ';  max-age={3}'

        value = value.format(self.sesh_key,
                             sesh_cookie,
                             datetime_to_http_date(expires),
                             duration)

        scheme = session.environ.get('wsgi.url_scheme', '')
        if scheme.lower() == 'https':
            value += '; Secure'

        headers.append(('Set-Cookie', value))

    def _delete_session_cookie(self, environ, headers, name):
        expires = strftime("%a, %d-%b-%Y %T GMT", gmtime(10))
        value = '{0}=deleted; Path=/; HttpOnly; Expires={1}'.format(name, expires)

        scheme = environ.get('wsgi.url_scheme', '')
        if scheme.lower() == 'https':
            value += '; Secure'

        headers.append(('Set-Cookie', value))

    def track_long_term(self, session, pi):
        if session.dura_type != 'long':
            return

        username = session.get('username')

        # ensure username is present if setting long term session!
        if not username:
            session.dura_type = 'short'
            session['is_long'] = False
            return

        pi.lpush(self.long_sessions_key.format(username), session.key)

    def clear_long_term(self, username):
        list_key = self.long_sessions_key.format(username)

        long_sesh_keys = self.redis.lrange(list_key, 0, -1)

        with redis_pipeline(self.redis) as pi:
            for key in long_sesh_keys:
                pi.delete(key)

            pi.delete(list_key)

    def signed_cookie_to_id(self, sesh_cookie):
        serial = URLSafeTimedSerializer(self.secret_key)

        try:
            return serial.loads(sesh_cookie)
        except BadSignature as b:
            return None

    def id_to_signed_cookie(self, sesh_id, is_restricted):
        return URLSafeTimedSerializer(self.secret_key).dumps([sesh_id, is_restricted])

    def make_id(self):
        return base64.b64encode(os.urandom(20)).decode('utf-8')

    def make_id_and_key(self):
        sesh_id = self.make_id()
        redis_key = self.key_template.format(sesh_id)

        return sesh_id, redis_key


