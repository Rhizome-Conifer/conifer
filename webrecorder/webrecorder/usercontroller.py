from bottle import request, response, HTTPError
from webrecorder.basecontroller import BaseController

from webrecorder.webreccork import ValidationException
from werkzeug.useragents import UserAgent


# ============================================================================
class UserController(BaseController):
    def __init__(self, app, jinja_env, manager, config):
        super(UserController, self).__init__(app, jinja_env, manager, config)
        self.default_user_desc = config['user_desc']

    def init_routes(self):
        # User Info
        @self.app.get(['/<user>', '/<user>/'])
        @self.jinja2_view('user.html')
        def user_info(user):
            self.redir_host()

            if self.manager.is_anon(user):
                self.redirect('/' + user + '/temp')

            self.manager.assert_user_exists(user)

            result = {'user': user,
                      'user_info': self.manager.get_user_info(user),
                      'collections': self.manager.get_collections(user),
                     }

            if not result['user_info'].get('desc'):
                result['user_info']['desc'] = self.default_user_desc.format(user)

            return result

        @self.app.get('/api/v1/anon_user')
        def get_anon_user():
            return {'anon_user': self.manager.get_anon_user(True)}

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

        @self.app.post('/_reportissues')
        def report_issues():
            useragent = request.headers.get('User-Agent')

            @self.jinja2_view('email_error.html')
            def error_email(params):
                ua = UserAgent(params.get('ua'))
                if ua.browser:
                    browser = '{0} {1} {2} {3}'
                    lang = ua.language or ''
                    browser = browser.format(ua.platform, ua.browser,
                                             ua.version, lang)

                    params['browser'] = browser
                else:
                    params['browser'] = ua.string

                params['time'] = params['time'][:19]
                return params

            self.manager.report_issues(request.POST, useragent, error_email)
            return {}

        # Skip POST request recording
        @self.app.get('/_skipreq')
        def skip_req():
            url = request.query.getunicode('url')
            user = self.manager.get_curr_user()
            if not user:
                user = self.manager.get_anon_user()

            self.manager.skip_post_req(user, url)
            return {}





