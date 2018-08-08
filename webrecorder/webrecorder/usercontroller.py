
import json
import redis

from bottle import request, response

from webrecorder.basecontroller import BaseController, wr_api_spec

from webrecorder.webreccork import ValidationException
from webrecorder.utils import get_bool

from urllib.parse import urlencode


# ============================================================================
class UserController(BaseController):
    def __init__(self, *args, **kwargs):
        super(UserController, self).__init__(*args, **kwargs)
        config = kwargs['config']

        self.default_user_desc = config['user_desc']

    def get_user_or_raise(self, username=None, status=403, msg='unauthorized'):
        # ensure correct host
        if self.app_host and request.environ.get('HTTP_HOST') != self.app_host:
            return self._raise_error(403, 'unauthorized')

        # if no username, check if logged in
        if not username:
            if self.access.is_anon():
                self._raise_error(status, msg)
            return

        user = self.get_user(user=username)

        # check permissions
        if not self.access.is_logged_in_user(user) and not self.access.is_superuser():
            self._raise_error(status, msg)

        return user

    def init_routes(self):
        wr_api_spec.set_curr_tag('Auth')

        # USER CHECKS
        @self.app.get('/api/v1/auth/check_username/<username>')
        def test_username(username):
            """async precheck username availability on signup form"""

            try:
                if username not in self.user_manager.RESTRICTED_NAMES:
                    self.user_manager.all_users[username]
            except:
                return {'success': True}

            return self._raise_error(400, 'not_available')

        # GET CURRENT USER
        @self.app.get('/api/v1/auth/curr_user')
        def load_auth():
            user = self.access.init_session_user(persist=True)
            return {'user': user.serialize()}

        # REGISTRATION
        @self.app.post('/api/v1/auth/register')
        def api_register_user():
            data = request.json or {}

            msg, redir_extra = self.user_manager.register_user(data, self.get_host())

            if 'success' in msg:
                return msg

            response.status = 400

            return {'errors': msg}

        @self.app.post('/api/v1/auth/validate')
        def api_validate_reg_user():
            reg = self.post_get('reg', '')

            cookie = request.environ.get('webrec.request_cookie', '')

            result = self.user_manager.validate_registration(reg, cookie)
            if 'error' in result or 'errors' in result:
                response.status = 400

            return result


        # LOGIN
        @self.app.post('/api/v1/auth/login')
        def login():
            """Authenticate users"""

            if not self.access.is_anon():
                return self._raise_error(403, 'already_logged_in')

            result = self.user_manager.login_user(request.json or {})

            if 'success' in result:
                data = {'user': self.access.session_user.serialize()}
                if result.get('new_coll_name'):
                    data['new_coll_name'] = result['new_coll_name']

                return data

            #self._raise_error(401, result.get('error', ''))
            response.status = 401
            return result

        @self.app.post('/api/v1/auth/logout')
        def logout():
            self.get_user_or_raise()

            self.user_manager.logout()

            data = {'success': 'logged_out'}

            return data

        # PASSWORD
        @self.app.post('/api/v1/auth/password/reset_request')
        def request_reset_password():
            data = request.json or {}
            email = data.get('email', '')
            username = data.get('username', '')
            host = self.get_host()

            try:
                self.user_manager.cork.send_password_reset_email(
                                          username=username,
                                          email_addr=email,
                                          subject='webrecorder.io password reset confirmation',
                                          email_template='webrecorder/templates/emailreset.html',
                                          host=host)

                return {'success': True}
            except Exception as e:
                import traceback
                traceback.print_exc()
                self._raise_error(404, 'no_such_user')

        @self.app.post('/api/v1/auth/password/reset')
        def reset_password():
            #self.get_user_or_raise()
            if not self.access.is_anon():
                return self._raise_error(403, 'already_logged_in')

            data = request.json or {}

            password = data.get('newPass', '')
            confirm_password = data.get('newPass2', '')
            reset_code = data.get('resetCode', '')

            try:
                self.user_manager.reset_password(password, confirm_password, reset_code)
                return {'success': True}
            except ValidationException as ve:
                self._raise_error(403, str(ve))

        @self.app.post('/api/v1/auth/password/update')
        def update_password():
            self.get_user_or_raise()

            data = request.json or {}

            curr_password = data.get('currPass', '')
            password = data.get('newPass', '')
            confirm_password = data.get('newPass2', '')

            try:
                self.user_manager.update_password(curr_password, password,
                                                  confirm_password)
                return {'success': True}
            except ValidationException as ve:
                return self._raise_error(403, str(ve))

        # Skip POST request recording
        @self.app.post('/api/v1/auth/skipreq')
        def skip_req():
            data = request.json or {}
            url = data.get('url', '')
            self.access.session_user.mark_skip_url(url)
            return {'success': True}


        # USER API
        wr_api_spec.set_curr_tag('Users')

        @self.app.get('/api/v1/user/<username>')
        def api_get_user(username):
            """API enpoint to return user info"""
            include_colls = get_bool(request.query.get('include_colls', True))

            user = self.get_user(user=username)

            user_data = user.serialize(include_colls=include_colls)

            return {'user': user_data}

        @self.app.delete('/api/v1/user/<username>')
        def api_delete_user(username):
            """API enpoint to delete a user"""
            self.get_user_or_raise(username, 404, 'not_found')

            # TODO? add validation
            #self.validate_csrf()
            try:
                assert(self.user_manager.delete_user(username))
                request.environ['webrec.delete_all_cookies'] = 'all'
            except:
                #return {'error_message': 'Could not delete user: ' + username}
                return self._raise_error(400, 'error_deleting')

            data = {'deleted_user': username}
            return data

        @self.app.post('/api/v1/user/<username>')
        def update_user(username):
            user = self.get_user(user=username)

            data = request.json or {}

            if 'desc' in data:
                user['desc'] = data['desc']

            if 'display_name' in data:
                user['display_name'] = data['display_name'][:150]

            if 'display_url' in data:
                user['display_url'] = data['display_url'][:500]

            return {'success': True}


        # OLD VIEWS BELOW
        # ====================================================================
        @self.app.get(['/<username>', '/<username>/'])
        @self.jinja2_view('user.html')
        def user_info(username):
            self.redir_host()

            user = self.get_user(user=username)

            if self.access.is_anon(user):
                self.redirect('/' + user.my_id + '/temp')

            result = {
                'user': user.name,
                'user_info': user.serialize(),
                'collections': [coll.serialize() for coll in user.get_collections()],
            }

            if not result['user_info'].get('desc'):
                result['user_info']['desc'] = self.default_user_desc.format(user)

            return result

