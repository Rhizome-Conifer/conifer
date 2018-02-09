
import json
import time
import redis
import os
import re

from bottle import request, response

from webrecorder.basecontroller import BaseController
from webrecorder.schemas import (CollectionSchema, NewUserSchema, TempUserSchema,
                                 UserSchema, UserUpdateSchema)
from webrecorder.webreccork import ValidationException


# ============================================================================
class UserController(BaseController):
    def __init__(self, *args, **kwargs):
        super(UserController, self).__init__(*args, **kwargs)
        config = kwargs['config']

        self.cork = kwargs['cork']

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
                return self.load_auth()

            #self._raise_error(401, result.get('error', ''), api=True)
            response.status = 401
            return result

        @self.app.get('/api/v1/logout')
        @self.user_manager.auth_view()
        def logout():
            self.user_manager.cork.logout(success_redirect='/')


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

            user_obj = user.serialize()
            user_obj['username'] = username

            # assemble space usage
            total = user.get_size_allotment()
            avail = user.get_size_remaining()
            user_obj['space_utilization'] = {
                'total': total,
                'used': total - avail,
                'available': avail,
            }

            user_data, err = UserSchema().load(user_obj)

            if include_colls:
                colls = user.get_collections()

                # colls is a list so will always be `many` even if one collection
                # collections, err = CollectionSchema().load(colls, many=True)
                user_data['collections'] = [coll.serialize() for coll in colls]

            return {'user': user_data}

        @self.app.put(['/api/v1/users/<username>', '/api/v1/users/<username>/'])
        @self.user_manager.auth_view()
        def api_update_user(username):
            """API enpoint to update user info

               See `UserUpdateSchema` for available fields.

               ** bottle 0.12.9 doesn't support `PATCH` methods.. update to
                  patch once availabile.
            """
            users = self.manager.get_users()
            available_roles = [x for x in self.cork._store.roles]

            if username not in users:
                self._raise_error(404, 'No such user')

            # if not admin, check ownership
            if not self.access.is_anon(username) and not self.access.is_superuser():
                self.access.assert_is_curr_user(username)

            user = users[username]
            try:
                json_data = json.loads(request.forms.json)
            except Exception as e:
                print(e)
                return {'errors': 'bad json data'}

            if len(json_data.keys()) == 0:
                return {'errors': 'empty payload'}

            data, err = UserUpdateSchema(only=json_data.keys()).load(json_data)

            if 'role' in data and data['role'] not in available_roles:
                err.update({'role': 'Not a valid choice.'})

            if len(err):
                return {'errors': err}

            if 'name' in data:
                user['desc'] = '{{"name":"{name}"}}'.format(name=data.get('name', ''))

            #
            # restricted resources
            #
            if 'max_size' in data and self.manager.is_superuser():
                key = self.manager.user_key.format(user=username)
                max_size = float(data['max_size'])
                # convert GB to bytes
                max_size = int(max_size * 1000000000)

                with redis.utils.pipeline(self.redis) as pi:
                    pi.hset(key, 'max_size', max_size)

            if 'role' in data and self.manager.is_superuser():
                # set new role or default to base role
                user['role'] = data['role']

            #
            # return updated user data
            #
            total = self.manager.get_size_allotment(username)
            used = self.manager.get_size_usage(username)
            user['space_utilization'] = {
                'total': total,
                'used': used,
                'available': total - used,
            }

            user_data, err = UserSchema(exclude=('username',)).load(user)
            colls = self.manager.get_collections(username,
                                                 include_recs=True,
                                                 api=True)

            for coll in colls:
                for rec in coll['recordings']:
                    rec['pages'] = self.manager.list_pages(username,
                                                           coll['id'],
                                                           rec['id'])

            # colls is a list so will always be `many` even if one collection
            collections, err = CollectionSchema().load(colls, many=True)
            user_data['collections'] = collections

            return {'user': user_data}

        @self.app.delete(['/api/v1/users/<username>', '/api/v1/users/<username>/'])
        @self.user_manager.auth_view()
        def api_delete_user(username):
            """API enpoint to delete a user"""
            if self.user_manager.delete_user(username):
                return {'deleted_user': username}
            else:
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

            if not result['user_info'].get('description'):
                result['user_info']['description'] = self.default_user_desc.format(user)

            return result

        @self.app.post('/api/v1/users/<username>/desc')
        def update_desc(username):
            """legacy, eventually move to the patch endpoint"""
            desc = request.body.read().decode('utf-8')
            user = self.get_user(user=username)

            user['description'] = desc
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

                redir_to = '/'
                request.environ['webrec.delete_all_cookies'] = 'all'
                self.cork.logout(success_redirect=redir_to, fail_redirect=redir_to)
            else:
                self.flash_message('There was an error deleting {0}'.format(username))
                self.redirect(self.get_path(username))

        # Skip POST request recording
        @self.app.get('/_skipreq')
        def skip_req():
            url = request.query.getunicode('url')
            self.access.session_user.mark_skip_url(url)
            return {}

