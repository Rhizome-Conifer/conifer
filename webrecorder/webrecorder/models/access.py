""":synopsis: Webrecorder session access class."""
from bottle import template, request, HTTPError

from webrecorder.models.user import SessionUser
from webrecorder.models.base import BaseAccess


# ============================================================================
class SessionAccessCache(BaseAccess):
    """Webrecorder session access.

    :cvar str READ_PREFIX: Redis key prefix (read access)
    :cvar str WRITE_PREFIX: Redis key prefix (write access)
    :ivar Session sesh: session
    :ivar StrictRedis redis: Redis interface
    :ivar SessionUser _session_user: logged-in user
    """
    READ_PREFIX = 'r:'
    WRITE_PREFIX = 'w:'

    def __init__(self, session, redis):
        """Initialize Webrecorder session access.

        :param Session session: Webrecorder session
        :param StrictRedis redis: Redis interface
        """
        self.sesh = session
        self.redis = redis

        self._session_user = None

    @property
    def session_user(self):
        """Read-only attribute session user."""
        return self.init_session_user(persist=False)

    def init_session_user(self, persist=True, reset=False):
        """Initialize session user.

        :param bool persist: whether to persist session user

        :returns: session user
        :rtype: SessionUser
        """
        if not self._session_user or reset:
            self._session_user = SessionUser(sesh=self.sesh,
                                             redis=self.redis,
                                             access=self,
                                             persist=persist)

        return self._session_user

    def get_anon_ttl(self):
        """Get session TTL.

        :returns: TTL
        :rtype: int
        """
        return self.sesh.ttl

    def log_in(self, username, remember_me):
        """Log user in.

        :param str username: username
        :param bool remember_me: whether to extend session TTL
        """
        # log in session!
        self.sesh.log_in(username, remember_me)

        # force session user reinit
        self._session_user = None

    def is_anon(self, user=None):
        """Return whether current (or given) user is anonymous user.

        :param User user: user

        :returns: whether user is anonymous user
        :rtype: bool
        """
        if not user:
            user = self.session_user

        #return self.sesh.is_anon(user.my_id)
        return user.is_anon()

    def is_logged_in_user(self, user):
        """Return whether given user is logged in.

        :param User user: user

        :returns: whether given user is logged in
        :rtype: bool
        """
        if self.sesh.is_restricted:
            return False

        return self.session_user == user

    def is_superuser(self):
        """Return whether current user is superuser, i.e. has the role
        'admin' (level 100).

        :returns: whether current user is superuser
        :rtype: bool
        """
        return self.sesh.curr_role == 'admin'

    def assert_is_superuser(self):
        """Assert current user is superuser, i.e. has the role 'admin'
        (level 100)."""
        if not self.is_superuser():
            raise HTTPError(404, 'No Access')

    def is_coll_owner(self, collection):
        """Return whether current user is also owner of given collection.

        :param Collection collection: collection

        :returns: whether current user is owner
        :rtype: bool
        """
        return self.session_user.is_owner(collection.get_owner())

    def check_write_access(self, collection):
        """Return whether current user has right to modify collection.

        :param Collection collection: collection

        :returns: whether user has right to modify collection
        :rtype: bool
        """
        if not collection:
            return False

        if self.is_coll_owner(collection):
            return True

        return collection.get_prop(self.WRITE_PREFIX + self.session_user.my_id) != None

    def check_read_access_public(self, collection, allow_superuser=True):
        """Return whether current user has right to read collection (either
        because it is public, user is also owner or optionally
        user is superuser).

        :param Collection collection: collection
        :param bool allow_superuser: whether superuser has right to read

        :returns: whether current user has right to read or whether collection
        is public
        :rtype: bool or str
        """
        if not collection:
            return False

        if collection.is_public():
            return 'public'

        # if superuser is allowed, then can read
        if allow_superuser and self.is_superuser():
            return True

        if self.is_coll_owner(collection):
            return True

        if self.is_anon():
            return False

        return collection.get_prop(self.READ_PREFIX + self.session_user.my_id) != None

    def can_read_coll(self, collection, allow_superuser=True):
        """Return whether current user has right to read collection.

        :param Collection collection: collection
        :param bool allow_superuser: whether superuser has right to read

        :returns: whether current user has right to read collection
        :rtype: bool
        """
        return bool(self.check_read_access_public(collection, allow_superuser=allow_superuser))

    def assert_can_read_coll(self, collection):
        """Assert current user has right to read collection.

        :param Collection collection: collection
        """
        if not self.can_read_coll(collection):
            raise HTTPError(404, 'No Read Access')

    def can_write_coll(self, collection):
        """Return whether current user has right to modify collection.

        :param Collection collection: collection

        :returns: whether current user has right
        :rtype: bool
        """
        return self.check_write_access(collection)

    def assert_can_write_coll(self, collection):
        """Assert current user has right to modify collection.

        :param Collection collection: collection
        """
        if not self.can_write_coll(collection):
            raise HTTPError(404, 'No Write Access')

    # for now, equivalent to is_owner(), but a different
    # permission, and may change
    def can_admin_coll(self, collection):
        """Return whether current user has right to administrate collection.

        :param Collection collection: collection

        :returns: whether current user has right
        :rtype: bool
        """
        if self.sesh.is_restricted or not collection:
            return False

        return self.is_coll_owner(collection)

    def assert_can_admin_coll(self, collection):
        """Assert currrent user has right to administrate collection.

        :param Collection collection: collection
        """
        if not self.can_admin_coll(collection):
            raise HTTPError(404, 'No Admin Access')

    def is_curr_user(self, user):
        """Return whether given user is logged-in user.

        :param User user: user

        :returns: whether given user is logged-in user
        :rtype: bool
        """
        return self.session_user == user

    def assert_is_curr_user(self, user):
        """Assert given user is current user or current user is superuser.

        :param User user: user
        """
        if not self.is_curr_user(user) and not self.is_superuser():
            raise HTTPError(404, 'Only Valid for Current User')

    def assert_is_logged_in(self):
        """Assert current user is logged in."""
        if self.session_user.is_anon():
            raise HTTPError(404, 'Not Logged In')

    def can_read_list(self, blist):
        """Return whether current user has right to read list of bookmarks.

        :param BookmarkList blist: list of bookmarks

        :returns: whether current user has right to read list
        :rtype: bool
        """
        if not blist:
            return False

        coll = blist.get_owner()

        if self.is_coll_owner(coll):
            return True

        if coll.is_public() and blist.is_public():
            return True

        return False

    def assert_can_read_list(self, blist):
        """Assert current user has right to read list.

        :param BookmarkList blist: list of bookmarks
        """
        if not self.can_read_list(blist):
            raise HTTPError(404, 'No List Access')
