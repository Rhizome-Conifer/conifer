from bottle import request, response, HTTPError
from webrecorder.basecontroller import BaseController

from webrecorder.webreccork import ValidationException


# ============================================================================
class UserController(BaseController):
    DEFAULT_USER_DESC = u"""
## {0} archive

Available collections are listed below.
"""

    def init_routes(self):
        # User Info
        @self.app.get(['/<user>', '/<user>/'])
        @self.jinja2_view('user.html')
        def user_info(user):
            self.manager.assert_user_exists(user)

            result = {'user': user,
                      'user_info': self.manager.get_user_info(user),
                      'colls': self.manager.get_collections(user),
                     }

            if not result['user_info'].get('desc'):
                result['user_info']['desc'] = self.DEFAULT_USER_DESC.format(user)

            return result

        @self.app.post('/api/v1/users/<user>/desc')
        def update_desc(user):
            desc = request.body.read().decode('utf-8')

            self.manager.set_user_desc(user, desc)
            return {}

        # User Account Settings
        @self.app.get('/<user>/_settings')
        @self.jinja2_view('account.html')
        def account_settings(user):
            self.manager.assert_user_is_owner(user)

            return {'user': user,
                    'user_info': self.manager.get_user_info(user),
                    'num_coll': self.manager.num_collections(user),
                   }

        # Delete User Account
        @self.app.post('/<user>/$delete')
        def delete_user(user):
            if self.manager.delete_user(user):
                self.flash_message('The user {0} has been permanently deleted!'.format(user), 'success')

                redir_to = '/'
                request.environ['webrec.delete_all_cookies'] = 'all'
                self.manager.cork.logout(success_redirect=redir_to, fail_redirect=redir_to)
            else:
                self.flash_message('There was an error deleting {0}'.format(coll))
                self.redirect(self.get_path(user))

        # Expiry Message
        @self.app.route('/_expire')
        def expire():
            self.flash_message('Sorry, the anonymous collection has expired due to inactivity')
            self.redirect('/')

