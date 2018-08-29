from cork import Cork, AAAException, AuthException
import os

from webrecorder.redisutils import RedisTable
from webrecorder.models.user import UserTable
from webrecorder.models.base import BaseAccess


class WebRecCork(Cork):
    """Webrecorder authentication, authorization and accounting."""

    def verify_password(self, username, password):
        """Explicit username/password verification.

        :param str username: username
        :param str password: password

        :returns: success or failure
        :rtype: bool
        """
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
        """Update password.

        :param str username: username
        :param str password: password
        """
        user = self.user(username)
        if user is None:
            raise AAAException("Nonexistent user.")
        user.update(pwd=password)

    def do_login(self, username):
        """Log user in.

        :param str username: username
        """
        self._setup_cookie(username)
        self._store.users[username].update_last_login()
        self._store.save_users()

    def is_authenticate(self, username, password):
        """Authenticate user.

        :param str username: username
        :param str password: password

        :returns: success or failure
        :rtype: bool
        """
        if username in self._store.users:
            if hasattr(salted_hash, 'encode'):
                salted_hash = salted_hash.encode('ascii')
            authenticated = self._verify_password(
                username,
                password,
                salted_hash,
            )
        else:
            authenticated = False
        return authenticated

    def validate_registration(self, registration_code):
        """Process pending account registration and create account in case of
        success.

        :param str registration_code: registration ID

        :returns: username and description
        :rtype: str and str
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
            'reg_data': data['desc'],
            'creation_date': data['creation_date'],
        }
        self._store.users[username].update_last_login()
        self._store.save_users()
        return username, data['desc']

    @staticmethod
    def create_cork(redis, config):
        """Create WebRecCork object.

        :param StrictRedis redis: Redis interface
        :param dict config: configuration

        :returns: WebRecCork object
        :rtype: WebRecCork
        """
        backend = RedisCorkBackend(redis)
        WebRecCork.init_cork_backend(backend)

        email_sender = os.path.expandvars(config.get('email_sender', ''))
        smtp_url = os.path.expandvars(config.get('email_smtp_url', ''))

        cork = WebRecCork(
            backend=backend,
            email_sender=email_sender,
            smtp_url=smtp_url,
            session_key_name='webrec.session'
        )
        return cork

    @staticmethod
    def init_cork_backend(backend):
        """Initialize Cork backend.

        :param RedisCorkBackend backend: Redis hash interface
        """
        class InitCork(Cork):
            """Mock Cork."""

            @property
            def current_user(self):
                """Get current mock user.

                :returns: current mock user
                :rtype: MockUser
                """
                class MockUser(object):
                    """Mock user."""

                    @property
                    def level(self):
                        """Get role level.

                        :returns: level
                        :rtype: int
                        """
                        return 100

                return MockUser()

        cork = InitCork(backend=backend)

        roles = [r[0] for r in cork.list_roles()]
        if 'archivist' not in roles:
            cork.create_role('archivist', 50)
        if 'admin' not in roles:
            cork.create_role('admin', 100)
        if 'beta-archivist' not in roles:
            cork.create_role('beta-archivist', 60)
        if 'public-archivist' not in roles:
            cork.create_role('public-archivist', 25)
        if 'mounts-archivist' not in roles:
            cork.create_role('mounts-archivist', 60)
        if 'opendachs' not in roles:
            cork.create_role('opendachs', 0)


class RedisCorkBackend(object):
    """Redis hash interface (current users and roles, as well as pending
    registrations).

    :ivar StrictRedis redis: Redis interface
    :ivar RedisTable users: Redis hash interface (current users)
    :ivar RedisTable roles: Redis hash interface (roles)
    :ivar RedisTable pending_registrations: Redis hash interface
    (pending registrations)
    """

    def __init__(self, redis):
        """Initialize Redis hash interface.

        :param StrictRedis redis: Redis interface
        """
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



class ValidationException(Exception):
    """Exception raised on failure to validate sth., such as passwords."""
    pass
