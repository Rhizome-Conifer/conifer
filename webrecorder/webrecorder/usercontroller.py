
import json
import redis

from bottle import request, response

from webrecorder.basecontroller import BaseController

from webrecorder.webreccork import ValidationException


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

    def init_routes(self):
        # MISC CHECKS
        @self.app.get('/api/v1/load_auth')
        def load_auth():
            return self.load_auth()

        @self.app.get('/api/v1/username_check')
        def test_username():
            """async precheck username availability on signup form"""
            username = request.query.username

            if username in self.user_manager.RESTRICTED_NAMES:
                return {'available': False}

            try:
                self.user_manager.all_users[username]
                return {'available': False}
            except:
                return {'available': True}

        @self.app.get('/api/v1/anon_user')
        def get_anon_user():
            sesh_user = self.access.init_session_user(persist=True)
            return {'anon_user': sesh_user.my_id}

        @self.app.get('/api/v1/curr_user')
        def get_curr_user():
            sesh_user = self.access.session_user
            return {'curr_user': sesh_user.my_id}


        # REGISTRATION
        @self.app.post(['/api/v1/userreg', '/api/v1/userreg/'])
        def api_register_user():
            data = request.json

            msg, redir_extra = self.user_manager.register_user(data, self.get_host())

            if 'success' in msg:
                return msg

            return {'errors': msg}

        @self.app.post(['/api/v1/userval'])
        def api_validate_reg_user():
            reg = self.post_get('reg', '')

            cookie = request.environ.get('webrec.request_cookie', '')

            result = self.user_manager.validate_registration(reg, cookie)
            return result


        # LOGIN
        @self.app.post('/api/v1/login')
        def login():
            """Authenticate users"""
            result = self.user_manager.login_user(request.json)

            if 'success' in result:
                data = self.load_auth()
                if result.get('new_coll_name'):
                    data['new_coll_name'] = result['new_coll_name']

                return data

            #self._raise_error(401, result.get('error', ''), api=True)
            response.status = 401
            return result

        @self.app.get('/api/v1/logout')
        @self.user_manager.auth_view()
        def logout():
            self.user_manager.logout()
            return {'message': 'Sucessefully logged out'}

        # PASSWORD
        @self.app.post('/api/v1/updatepassword')
        @self.user_manager.auth_view()
        def update_password():
            curr_password = self.post_get('currPass')
            password = self.post_get('newPass')
            confirm_password = self.post_get('newPass2')

            try:
                self.user_manager.update_password(curr_password, password,
                                                     confirm_password)
                return {}
            except ValidationException as ve:
                return self._raise_error(403, str(ve), api=True)

        # USER INFO
        @self.app.get(['/api/v1/temp-users/<username>', '/api/v1/temp-users/<username>/'])
        def api_get_temp_user(username):
            anon_user = self.user_manager.get_valid_anon_user(username)

            if not anon_user:
                return self._raise_error(404, 'Temp user not found.', api=True)

            data = anon_user.serialize(compute_size_allotment=True)

            return data


        @self.app.get(['/api/v1/users/<username>', '/api/v1/users/<username>/'])
        @self.user_manager.auth_view()
        def api_get_user(username):
            """API enpoint to return user info"""

            user = self.get_user(user=username)

            # check permissions
            if not self.access.is_superuser():
                self.access.assert_is_curr_user(user)

            include_colls = True

            if request.query.include_colls:
                include_colls = request.query.include_colls == 'true'

            user_data = user.serialize(compute_size_allotment=True,
                                       include_colls=include_colls)

            return {'user': user_data}

        @self.app.delete(['/api/v1/users/<username>', '/api/v1/users/<username>/'])
        @self.user_manager.auth_view()
        def api_delete_user(username):
            """API enpoint to delete a user"""
            # TODO? add validation
            #self.validate_csrf()
            try:
                assert(self.user_manager.delete_user(username))
                return {'deleted_user': username}
            except:
                return {'error_message': 'Could not delete user: ' + username}


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

        @self.app.post('/api/v1/users/<username>/desc')
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

