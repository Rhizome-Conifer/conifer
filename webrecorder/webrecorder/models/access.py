from bottle import template, request, HTTPError

from webrecorder.models.user import SessionUser
from webrecorder.models.base import BaseAccess


# ============================================================================
class SessionAccessCache(BaseAccess):
    READ_PREFIX = 'r:'
    WRITE_PREFIX = 'w:'

    def __init__(self, session, redis):
        self.sesh = session
        self.redis = redis

        self._session_user = None

    @property
    def session_user(self):
        return self.init_session_user(persist=False)

    def init_session_user(self, persist=True):
        if not self._session_user:
            self._session_user = SessionUser(sesh=self.sesh,
                                             redis=self.redis,
                                             access=self,
                                             persist=persist)

        return self._session_user

    def get_anon_ttl(self):
        return self.sesh.ttl

    def log_in(self, username, remember_me):
        # log in session!
        self.sesh.log_in(username, remember_me)

        # force session user reinit
        self._session_user = None

    def is_anon(self, user=None):
        if not user:
            user = self.session_user

        #return self.sesh.is_anon(user.my_id)
        return user.is_anon()

    def is_logged_in_user(self, user):
        if self.sesh.is_restricted:
            return False

        return self.session_user == user

    def is_superuser(self):
        """Test if logged in user has 100 level `admin` privledges.
           Named `superuser` to prevent confusion with `can_admin`
        """
        return self.sesh.curr_role == 'admin'

    def assert_is_superuser(self):
        if not self.is_superuser():
            raise HTTPError(404, 'No Access')

    def is_coll_owner(self, collection):
        return self.session_user.is_owner(collection.get_owner())

    def check_write_access(self, collection):
        if not collection:
            return False

        if self.is_coll_owner(collection):
            return True

        return collection.get_prop(self.WRITE_PREFIX + self.session_user.my_id) != None

    def check_read_access_public(self, collection, allow_superuser=True):
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
        return bool(self.check_read_access_public(collection, allow_superuser=allow_superuser))

    def assert_can_read_coll(self, collection):
        if not self.can_read_coll(collection):
            raise HTTPError(404, 'No Read Access')

    def can_write_coll(self, collection):
        return self.check_write_access(collection)

    def assert_can_write_coll(self, collection):
        if not self.can_write_coll(collection):
            raise HTTPError(404, 'No Write Access')

    # for now, equivalent to is_owner(), but a different
    # permission, and may change
    def can_admin_coll(self, collection):
        if self.sesh.is_restricted or not collection:
            return False

        return self.is_coll_owner(collection)

    def assert_can_admin_coll(self, collection):
        if not self.can_admin_coll(collection):
            raise HTTPError(404, 'No Admin Access')

    def is_curr_user(self, user):
        return self.session_user == user

    def assert_is_curr_user(self, user):
        if not self.is_curr_user(user) and not self.is_superuser():
            raise HTTPError(404, 'Only Valid for Current User')

    def assert_is_logged_in(self):
        if self.session_user.is_anon():
            raise HTTPError(404, 'Not Logged In')

    def can_read_list(self, blist):
        if not blist:
            return False

        coll = blist.get_owner()

        if self.is_coll_owner(coll):
            return True

        if coll.is_public() and blist.is_public():
            return True

        return False

    def assert_can_read_list(self, blist):
        if not self.can_read_list(blist):
            raise HTTPError(404, 'No List Access')

