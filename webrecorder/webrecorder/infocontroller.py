from bottle import request, response, HTTPError
from webrecorder.basecontroller import BaseController

from webrecorder.webreccork import ValidationException


# ============================================================================
class InfoController(BaseController):
    def init_routes(self):
        # User Info
        @self.app.get(['/<user>', '/<user>/'])
        @self.jinja2_view('user.html')
        def user_info(user):
            return {'user': user,
                    'user_info': self.manager.get_user_info(user),
                    'colls': self.manager.get_collections(user),
                   }

        # User Account Settings
        @self.app.get('/<user>/_settings')
        @self.jinja2_view('account.html')
        def account_settings(user):
            return {'user': user,
                    'user_info': self.manager.get_user_info(user),
                    'num_coll': self.manager.num_collections(user),
                   }

