# standard library imports
import os
import base64
import pickle
from datetime import datetime, timedelta
from os.path import expandvars

# third party imports
from itsdangerous import BadSignature, URLSafeTimedSerializer

# library specific imports
from warcio.timeutils import datetime_to_http_date
from webrecorder.utils import redis_pipeline
from webrecorder.cookieguard import CookieGuard


class Session(object):
    """Session manager.

    :cvar str TEMP_PREFIX: temp prefix

    :ivar environ: n.s.
    :ivar dict _sesh: session data
    :ivar str key: Redis key
    :ivar curr_user: current user
    :type curr_user: str or None
    :ivar curr_role: current role
    :type curr_role: str or None
    :ivar bool should_delete: n.s.
    :ivar bool should_save: n.s.
    :ivar bool should_renew: n.s.
    :ivar bool should_copy_cookie: n.s.
    :ivar bool is_restricted: toggle restricted session
    :ivar str dura_type: session duration
    :ivar int ttl: session TTL
    :ivar _anon: toggle anonymous session
    :type _anon: bool or None
    """
    TEMP_PREFIX = ''

    def __init__(self, cork, environ, key, sesh, ttl, is_restricted):
        """Initialize session manager.

        :param cork: n.s.
        :param environ: n.s.
        :param str key: Redis key
        :param dict sesh: session data
        :param int ttl: session TTL
        :param bool is_restricted: toggle restricted session
        """
        self.environ = environ
        self._sesh = sesh
        self.key = key

        self.curr_user = None
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
                self.curr_user = self._sesh.get('username')
                if self.curr_user:
                    self.curr_role = cork.user(self.curr_user).role

                if self.curr_role == 'public-archivist':
                    self.is_restricted = True

        except Exception as e:
            print(e)
            self.curr_user = None
            self.curr_role = None
            self.delete()

        message, msg_type = self.pop_message()

        params = {'curr_user': self.curr_user,
                  'curr_role': self.curr_role,
                  'csrf': self.get_csrf(),
                  'message': message,
                  'msg_type': msg_type}

        self.template_params = params

    def is_new(self):
        """Determine whether session is new, i.e., session TTL is set
        to initial value.

        :returns: whether session is new
        :rtype: bool
        """
        return self.ttl == -2

    def get_id(self):
        """Get session ID.

        :returns: session ID
        :rtype: str
        """
        if self.is_new():
            self.save()
        return self._sesh['id']

    def get_csrf(self):
        """Get CSRF token.

        :returns: CSRF token
        :rtype: str
        """
        return self._sesh.get('csrf', '')

    def set_id(self, id):
        """Set session ID.

        :param str id: session ID
        """
        self._sesh['id'] = id
        self.is_restricted = True
        self.dura_type = 'restricted'
        self.ttl = -2
        self.should_copy_cookie = True
        self.should_save = False

    def save(self):
        """Earmark session for being saved."""
        self.should_save = True

    def delete(self):
        """Earmark session for being deleted."""
        self.should_delete = True
        self.environ['webrec.delete_all_cookies'] = 'all'

    def __getitem__(self, name):
        return self._sesh[name]

    def __setitem__(self, name, value):
        self._sesh[name] = value
        self.should_save = True

    def get(self, name, value=None):
        """Get session data.

        :param str name: key
        :param str value: default value

        :returns: value
        """
        return self._sesh.get(name, value)

    def set_anon(self):
        """Set anonymous user (iff current user is not set)."""
        if not self.curr_user:
            self['anon'] = self.anon_user

    def is_anon(self, user=None):
        """Determine whether current user or given user
        is anonymous user.

        :param user: user
        :type: str or None

        :returns: whether current user or given user is anonymous user
        :rtype: bool
        """
        if self.curr_user:
            return False

        anon = self._sesh.get('anon')
        if not anon:
            return False

        if user:
            return user == anon

        return True

    def logged_in(self, extend_long=False):
        """Change session settings (user has logged in).

        :param bool extend_long: wheter to extend session duration
        """
        if extend_long:
            self.dura_type = 'long'
            self._sesh['is_long'] = True

        self.should_renew = True
        self.should_save = True
        self.environ['webrec.delete_all_cookies'] = 'non_sesh'

    def set_restricted_user(self, user):
        """Change user role.

        :param str user: user
        """
        if not self.is_new():
            return

        if user.startswith(self.TEMP_PREFIX):
            self._sesh['anon'] = user
            self._anon = user
            self.curr_role = 'anon'
        else:
            self._sesh['username'] = user
            self.curr_user = user
            self.curr_role = 'archivist'

        self.should_save = False
        self.should_renew = False

    @property
    def anon_user(self):
        """Get anonymous user.

        :returns: anonymous user ID
        :rtype: str
        """
        if self._anon:
            return self._anon

        self._anon = self._sesh.get('anon')
        if not self._anon:
            self._anon = self.make_anon_user()

        return self._anon

    def flash_message(self, msg, msg_type='danger'):
        """Set message.

        :param str msg: message
        :param str msg_type: message type
        """
        self['message'] = msg_type + ':' + msg

    def pop_message(self):
        """Get message.

        :returns: message and message type
        :rtype: str and str
        """
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
        """Get anonymous user ID.

        :returns: anonoymous user ID
        :rtype: str
        """
        anon = (
            Session.TEMP_PREFIX +
            base64.b32encode(os.urandom(5)).decode("utf-8")
        )
        return anon


class RedisSessionMiddleware(CookieGuard):
    """Redis session manager.

    :ivar StrictRedis redis: Redis interface
    :ivar cork: n.s.
    :ivar str auto_login_user: automatic login username
    :ivar str secret_key: secret key
    :ivar str key_template: format string session key
    """

    def __init__(self, app, cork, redis, session_opts):
        """Initialize Redis session manager.

        :param Bottle app: bottle application
        :param cork: n.s.
        :param StrictRedis redis: Redis interface
        :param dict session_opts: session settings
        """
        super().__init__(app, session_opts['session.key'])
        self.redis = redis
        self.cork = cork

        self.auto_login_user = os.environ.get('AUTO_LOGIN_USER')

        self.secret_key = expandvars(session_opts['session.secret'])

        self.key_template = session_opts['session.key_template']
        self.long_sessions_key = session_opts['session.long_sessions_key']

        self.durations = session_opts['session.durations']

    def init_session(self, environ):
        """Initialize session.

        :param dict environ: environment variables
        """
        data = None
        ttl = -2
        is_restricted = False
        force_save = False

        if 'wsgiprox.proxy_host' not in environ:
            try:
                sesh_cookie = self.split_cookie(environ)

                result = self.signed_cookie_to_id(sesh_cookie)

                if result:
                    sesh_id, is_restricted = result
                    redis_key = self.key_template.format(sesh_id)

                    result = self.redis.get(redis_key)
                    if result:
                        data = pickle.loads(base64.b64decode(result))
                        ttl = self.redis.ttl(redis_key)

                        # no csrf for existing session?
                        # add and save
                        if not data.get('csrf'):
                            data['csrf'] = self.make_id()
                            force_save = True

            except Exception:
                import traceback

                traceback.print_exc()
                print('Invalid Session, Creating New')

        # make new session
        if data is None:
            sesh_id, redis_key = self.make_id_and_key()

            data = {
                'id': sesh_id,
                'csrf': self.make_id()
            }

            # auto-login as designated user for each new session
            if self.auto_login_user:
                data['username'] = self.auto_login_user

        session = Session(self.cork,
                          environ,
                          redis_key,
                          data,
                          ttl,
                          is_restricted)

        if force_save:
            session.save()

        if session.curr_role == 'anon':
            session.template_params['anon_ttl'] = ttl

            anon_user = session['anon']
            self.redis.set('t:' + anon_user, sesh_id)

        if self.auto_login_user:
            session.template_params['auto_login'] = True

        environ['webrec.template_params'] = session.template_params
        environ['webrec.session'] = session

    def prepare_response(self, environ, headers):
        if 'wsgiprox.proxy_host' in environ:
            return

        super(RedisSessionMiddleware, self).prepare_response(environ, headers)

        session = environ['webrec.session']

        if session.should_delete:
            self._delete_cookie(headers, self.sesh_key)
            self.redis.delete(session.key)
        else:
            if session.should_renew:
                self.redis.delete(session.key)
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
                pi.expire(session.key, duration)

        if not set_cookie:
            return

        expires = datetime.utcnow() + timedelta(seconds=duration)

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
        if not sesh_cookie:
            return None

        sesh_cookie = sesh_cookie.strip()
        if not sesh_cookie.startswith(self.sesh_key + '='):
            return None

        sesh_cookie = sesh_cookie[len(self.sesh_key) + 1:]

        serial = URLSafeTimedSerializer(self.secret_key)

        try:
            return serial.loads(sesh_cookie)
        except BadSignature:
            return None

    def id_to_signed_cookie(self, sesh_id, is_restricted):
        urlsafetimedserializer = URLSafeTimedSerializer(self.secret_key)
        return urlsafetimedserializer.dumps([sesh_id, is_restricted])

    def make_id(self):
        """Get session ID.

        :returns: session ID
        :rtype: str
        """
        return base64.b64encode(os.urandom(20)).decode('utf-8')

    def make_id_and_key(self):
        """Get session ID and corresponding Redis key.

        :returns: session ID and Redis key
        :rtype: str and str
        """
        sesh_id = self.make_id()
        redis_key = self.key_template.format(sesh_id)
        return sesh_id, redis_key
