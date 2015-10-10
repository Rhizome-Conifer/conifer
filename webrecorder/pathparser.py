import os
from bottle import request


# ============================================================================
class WebRecPathParser(object):
    """ Defines various application paths and path templates
    both for webapp paths and on disk directory structure
    for logged-in and anonymous users

    An alternative path parser can provide a different dir structure
    """

    def __init__(self, root_dir):
        self.root_dir = root_dir

    def get_user_path_template(self):
        return '/<user>'

    def get_coll_path_template(self):
        return '/<user>/<coll>'

    def get_user_account_root(self, user):
        if user.startswith('@anon-'):
            anon_id = user.split('@anon-')[-1]
            return os.path.join(self.root_dir, 'anon', anon_id)

        return os.path.join(self.root_dir, 'accounts', user)

    def get_coll_root(self, user, coll):
        return os.path.join(self.get_user_account_root(user), 'collections', coll)

    def get_name_prefix(self, user, coll):
        if coll != '@anon':
            return user + '-' + coll
        else:
            return 'webarchive'

    def get_archive_dir(self, user, coll):
        if coll == '@anon':
            coll = 'anon'

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
