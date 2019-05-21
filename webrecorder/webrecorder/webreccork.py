from cork import Cork, AuthException
import os
import json

from webrecorder.redisutils import RedisTable
from webrecorder.models.user import UserTable
from webrecorder.models.base import BaseAccess


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
            raise ValidationException('no_such_user')
        user.update(pwd=password)

    def do_login(self, username):
        self._setup_cookie(username)
        self._store.users[username].update_last_login()
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

    def validate_registration(self, registration_code, expected_username=None):
        """Validate pending account registration, create a new account if
        successful.
        :param registration_code: registration code
        :type registration_code: str.
        """
        data = self._store.pending_registrations.pop(registration_code)
        if expected_username and expected_username in self._store.users:
            raise ValidationException('already_registered')

        if not data:
            raise ValidationException('invalid_code')

        username = data['username']
        if expected_username and expected_username != username:
            raise ValidationException('invalid_code')

        try:
            full_name = json.loads(data['desc'])['name']
        except:
            full_name = ''

        # the user data is moved from pending_registrations to _users
        self._store.users[username] = {
            'role': data['role'],
            'hash': data['hash'],
            'email_addr': data['email_addr'],
            'reg_data': data['desc'],
            'full_name': full_name,
            'creation_date': data['creation_date'],
        }
        self._store.users[username].update_last_login()
        self._store.save_users()
        return username, data['desc']

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
        if 'beta-archivist' not in roles:
            cork.create_role('beta-archivist', 60)
        if 'public-archivist' not in roles:
            cork.create_role('public-archivist', 25)
        if 'free-supporter' not in roles:
            cork.create_role('free-supporter', 60)
        if 'supporter' not in roles:
            cork.create_role('supporter', 60)
        if 'rate-unlimited-archivist' not in roles:
            cork.create_role('rate-unlimited-archivist', 60)


# ============================================================================
class RedisCorkBackend(object):
    def __init__(self, redis):
        self.redis = redis
        self.access = BaseAccess()
        self.users = UserTable(self.redis, self.get_access)
        self.roles = RedisTable(self.redis, 'h:roles')
        self.pending_registrations = RedisTable(self.redis, 'h:register')

    def get_access(self):
        return self.access

    def save_users(self): pass
    def save_roles(self): pass
    def save_pending_registrations(self): pass


# ============================================================================
class ValidationException(Exception):
    def __init__(self, msg=None):
        self.msg = msg


