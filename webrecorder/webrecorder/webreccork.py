from cork import Cork, AAAException
from datetime import datetime
import os

from webrecorder.redisutils import RedisTable


# ============================================================================
class WebRecCork(Cork):
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

    def is_authenticate(self, username, password):
        """ From login(), just authenticate without setting cookie
        """
        authenticated = False

        if username in self._store.users:
            salted_hash = self._store.users[username]['hash']
            if hasattr(salted_hash, 'encode'):
                salted_hash = salted_hash.encode('ascii')
            authenticated = self._verify_password(
                username,
                password,
                salted_hash,
            )

        return authenticated

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
        return username, data['desc']

    def _save_session(self):
        self._beaker_session['anon'] = None
        self._beaker_session.save()

    @staticmethod
    def create_cork(redis, config):
        backend=RedisCorkBackend(redis)
        WebRecCork.init_cork_backend(backend)

        email_sender = os.path.expandvars(config.get('email_sender', ''))
        smtp_url = os.path.expandvars(config.get('email_smtp_url', ''))

        cork = WebRecCork(backend=backend,
                    email_sender=email_sender,
                    smtp_url=smtp_url,
                    session_key_name='webrec.session')
        return cork

    @staticmethod
    def init_cork_backend(backend):
        class InitCork(Cork):
            @property
            def current_user(self):
                class MockUser(object):
                    @property
                    def level(self):
                        return 100
                return MockUser()

        cork = InitCork(backend=backend)

        # role initiation
        roles = [r[0] for r in cork.list_roles()]
        if 'archivist' not in roles:
            cork.create_role('archivist', 50)
        if 'admin' not in roles:
            cork.create_role('admin', 100)


# ============================================================================
class RedisCorkBackend(object):
    def __init__(self, redis):
        self.redis = redis
        self.users = RedisTable(self.redis, 'h:users')
        self.roles = RedisTable(self.redis, 'h:roles')
        self.pending_registrations = RedisTable(self.redis, 'h:register')

    def save_users(self): pass
    def save_roles(self): pass
    def save_pending_registrations(self): pass


# ============================================================================
class ValidationException(Exception):
    pass


