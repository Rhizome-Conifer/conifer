import os
from bottle import request






class BaseRouter(object):
    def __init__(self, root_dir='./'):
        self.root_dir = root_dir


class MultiUserRouter(BaseRouter):
    def get_user_path_template(self):
        return '/<user>'

    def get_coll_path_template(self):
        return '/<user>/<coll>'

    def get_user_account_root(self, user):
        return os.path.join(self.root_dir, 'accounts', user)

    def get_coll_root(self, user, coll):
        return os.path.join(self.root_dir, 'accounts', user, 'collections', coll)

    def get_archive_dir(self, user, coll):
        return os.path.join(self.get_coll_root(user, coll), 'archive')

    def user_home(self, user):
        return '/' + user

    def get_user_coll(self, collpath):
        user, coll = collpath.split('/', 1)
        return user, coll

    def get_coll_path(self, user, coll):
        return user + '/' + coll

    def get_path_shift(self):
        return 2

    def get_state(self, kwargs):
        user = kwargs.get('user', '')
        coll = kwargs.get('coll', '')

        return RouteInfo(self.get_coll_path(user, coll), user, coll)


class SingleUserRouter(BaseRouter):
    COLL = '/:coll'
    USER = '/'

    DEFAULT_USER = '@def'

    def get_user_account_root(self, user):
        return self.root_dir

    def get_archive_dir(self, user, coll):
        return os.path.join(self.root_dir, 'collections', coll)

    def user_home(self):
        return '/'

    def get_user_coll(self, collpath):
        return self.DEFAULT_USER, collpath

    def get_path_shift(self):
        return 1

    def get_state(self, kwargs):
        coll = kwargs.get('coll', '')
        return RouteInfo(coll, self.DEFAULT_USER, coll)
