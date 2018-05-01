
import json
import redis

from bottle import request, response

from webrecorder.basecontroller import BaseController

from webrecorder.webreccork import ValidationException
from webrecorder.utils import get_bool


# ============================================================================
class UserController(BaseController):
    def __init__(self, *args, **kwargs):
        super(UserController, self).__init__(*args, **kwargs)
        config = kwargs['config']

        self.default_user_desc = config['user_desc']

    # utility
    def load_auth(self):
        u = self.access.session_user

        return {
            'username': u.name,
            'role': u.curr_role,
            'anon': u.is_anon(),
            'coll_count': u.num_collections(),
        }

    def get_user_or_raise(self, username=None, status=403, msg='unauthorized'):
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
        # USER CHECKS
        @self.app.get('/api/v1/auth/check_username/<username>')
        def test_username(username):
            """async precheck username availability on signup form"""
            if username in self.user_manager.RESTRICTED_NAMES:
                return {'available': False}

            try:
                self.user_manager.all_users[username]
                return {'available': False}
            except:
                return {'available': True}

        @self.app.get('/api/v1/auth/anon_user')
        def get_anon_user():
            sesh_user = self.access.init_session_user(persist=True)
            return {'anon_user': sesh_user.my_id}

        @self.app.get('/api/v1/auth/curr_user')
        def get_curr_user():
            sesh_user = self.access.session_user
            return {'curr_user': sesh_user.my_id}

        # AUTH CHECK
        @self.app.get('/api/v1/auth')
        def load_auth():
            return self.load_auth()

        # REGISTRATION
        @self.app.post('/api/v1/auth/register')
        def api_register_user():
            data = request.json

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
            result = self.user_manager.login_user(request.json)

            if 'success' in result:
                data = self.load_auth()
                if result.get('new_coll_name'):
                    data['new_coll_name'] = result['new_coll_name']

                return data

            #self._raise_error(401, result.get('error', ''))
            response.status = 401
            return result

        @self.app.get('/api/v1/auth/logout')
        def logout():
            self.get_user_or_raise()

            self.user_manager.logout()
            return {'success': 'logged_out'}

        # PASSWORD
        @self.app.post('/api/v1/auth/updatepassword')
        def update_password():
            self.get_user_or_raise()

            curr_password = self.post_get('currPass')
            password = self.post_get('newPass')
            confirm_password = self.post_get('newPass2')

            try:
                self.user_manager.update_password(curr_password, password,
                                                     confirm_password)
                return {}
            except ValidationException as ve:
                return self._raise_error(403, str(ve))

        # USER INFO
        #@self.app.get(['/api/v1/temp-user/<username>', '/api/v1/temp-user/<username>/'])
        def api_get_temp_user(username):
            anon_user = self.user_manager.get_valid_anon_user(username)

            if not anon_user:
                return self._raise_error(404, 'Temp user not found.',)

            data = anon_user.serialize(compute_size_allotment=True)

            return data


        @self.app.get('/api/v1/user/<username>')
        def api_get_user(username):
            """API enpoint to return user info"""
            user = self.get_user_or_raise(username, 404, 'not_found')

            include_colls = get_bool(request.query.get('include_colls', True))

            user_data = user.serialize(compute_size_allotment=True,
                                       include_colls=include_colls)

            return {'user': user_data}

        @self.app.delete('/api/v1/user/<username>')
        def api_delete_user(username):
            """API enpoint to delete a user"""
            self.get_user_or_raise(username, 404, 'not_found')

            # TODO? add validation
            #self.validate_csrf()
            try:
                assert(self.user_manager.delete_user(username))
                return {'deleted_user': username}
            except:
                #return {'error_message': 'Could not delete user: ' + username}
                return self._raise_error(400, 'error_deleting')


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

        @self.app.post('/api/v1/user/<username>/desc')
        def update_desc(username):
            """legacy, eventually move to the patch endpoint"""
            desc = request.body.read().decode('utf-8')
            user = self.get_user(user=username)

            user['desc'] = desc
            return {}

        # User Account Settings
        @self.app.get('/_settings')
        @self.jinja2_view('account.html')
        def account_settings():
            self.access.assert_is_logged_in()

            user = self.access.session_user

            return {'user': user.name,
                    'user_info': user.serialize(),
                    'num_coll': user.num_collections(),
                   }

        # Delete User Account
        @self.app.post('/<username>/$delete')
        def delete_user(username):
            self.validate_csrf()
            if self.user_manager.delete_user(username):
                self.flash_message('The user {0} has been permanently deleted!'.format(username), 'success')

                request.environ['webrec.delete_all_cookies'] = 'all'
                self.user_manager.logout()
                self.redirect('/')
            else:
                self.flash_message('There was an error deleting {0}'.format(username))
                self.redirect(self.get_path(username))

        # Skip POST request recording
        @self.app.get('/_skipreq')
        def skip_req():
            url = request.query.getunicode('url')
            self.access.session_user.mark_skip_url(url)
            return {}

