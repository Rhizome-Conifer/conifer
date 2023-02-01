
import json
import redis
import requests
import os

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
        self.allow_external = get_bool(os.environ.get('ALLOW_EXTERNAL', False))
        self.recaptcha = os.environ.get('RECAPTCHA_KEY', None)

    def load_user(self, username=None):
        include_colls = get_bool(request.query.get('include_colls', False))

        if username:
            user = self.get_user(user=username)
        else:
            user = self.access.session_user

        return {'user': user.serialize(include_colls=include_colls),
                'is_new': self.get_session().is_new()}

    def new_auth(self):
        user = self.access.init_session_user(persist=True)

        return {'user': user.serialize()}

    def ensure_login(self):
        data = request.json or {}
        if 'username' in data:
            if self.access.session_user.name != data['username']:
                result = self.user_manager.login_user(data)
                if 'success' not in result:
                    return result

        else:
            if not self.access.is_anon():
                return {'error': 'already_logged_in'}

        user = self.access.init_session_user(persist=True, reset=True)

        title = data.get('title')
        if not title:
            return {'username': user.name,
                    'coll_empty': True,
                    'coll_created': False}

        coll_name = self.sanitize_title(title)

        is_external = data.get('external')
        if is_external:
            if not self.allow_external:
                self._raise_error(403, 'external_not_allowed')

        collection = user.get_collection_by_name(coll_name)
        if not collection:
            collection = user.create_collection(coll_name, title=title,
                                                public=data.get('public'))

            collection.set_external(is_external)

            coll_empty = True
            coll_created = True
        else:
            collection.reset_cdxj_ttl()
            coll_empty = collection.size == 0
            coll_created = False

        result = {'username': user.name,
                  'coll_empty': coll_empty,
                  'coll_created': coll_created
                 }

        return result

    def init_routes(self):
        wr_api_spec.set_curr_tag('Auth')

        # USER CHECKS
        @self.app.get('/api/v1/auth/check_username/<username>')
        def test_username(username):
            """async precheck username availability on signup form"""

            if self.user_manager.is_username_available(username):
                return {'success': True}
            else:
                return self._raise_error(400, 'username_not_available')

        # GET CURRENT USER
        @self.app.get('/api/v1/auth/curr_user')
        def load_user():
            return self.load_user()

        # AUTH NEW SESSION
        @self.app.post('/api/v1/auth/anon_user')
        def new_auth():
            return self.new_auth()

        # REGISTRATION
        @self.app.post('/api/v1/auth/register')
        def api_register_user():
            data = request.json or {}

            # if recaptcha enabled, verify
            if self.recaptcha:
                # check for client token
                if not data.get('captchaToken', None):
                    response.status = 400
                    return {'errors': {'recaptcha': 'suspicious'}}

                cr = requests.post('https://www.google.com/recaptcha/api/siteverify',
                    data={
                        'secret': self.recaptcha,
                        'response': data['captchaToken'],
                    })
                res = cr.json()

                if res['score'] <= 0.8:
                    response.status = 400
                    return {'errors': {'recaptcha': 'suspicious'}}

            # check for banned domains
            domain = data['email'].split('@')[1]
            if self.user_manager.domain_blocklisted(domain):
                response.status = 400
                return {'errors': {'domain': 'blocked'}}

            msg, redir_extra = self.user_manager.register_user(data, self.get_host())

            if 'success' in msg:
                return msg

            response.status = 400

            return {'errors': msg}

        @self.app.post('/api/v1/auth/validate')
        def api_validate_reg_user():
            data = request.json or {}
            reg = data.get('reg')

            cookie = request.environ.get('webrec.request_cookie', '')

            username = request.query.getunicode('username')

            result = self.user_manager.validate_registration(reg, cookie, username)
            if 'error' in result or 'errors' in result:
                response.status = 400

            return result

        # LOGIN
        @self.app.post('/api/v1/auth/login')
        def login():
            """Authenticate users"""

            if not self.access.is_anon():
                return self._raise_error(403, 'already_logged_in')

            include_colls = get_bool(request.query.get('include_colls', False))

            result = self.user_manager.login_user(request.json or {})

            if 'success' in result:
                data = {'user': self.access.session_user.serialize(include_colls)}
                if result.get('new_coll_name'):
                    data['new_coll_name'] = result['new_coll_name']

                return data

            #self._raise_error(401, result.get('error', ''))
            response.status = 401
            return result

        @self.app.post('/api/v1/auth/logout')
        def logout():
            self.user_manager.logout()

            data = {'success': 'logged_out'}

            return data

        @self.app.post('/api/v1/auth/ensure_login')
        def ensure_login():
            return self.ensure_login()

        # PASSWORD
        @self.app.post('/api/v1/auth/password/reset_request')
        def request_reset_password():
            data = request.json or {}
            email = data.get('email', '')
            username = data.get('username', '')
            host = self.get_host()
            rkey = 'reset-request:{}'.format(self._get_remote_ip())

            if self.user_manager.redis.exists(rkey):
                response.status = 429
                return {'error': 'reset_wait'}

            # set 5 minute timeout
            self.user_manager.redis.set(rkey, '', ex=5 * 60)

            try:
                self.user_manager.cork.send_password_reset_email(
                                          username=username,
                                          email_addr=email,
                                          subject='Conifer password reset confirmation',
                                          email_template='webrecorder/templates/emailreset.html',
                                          host=host)
            except Exception as e:
                import traceback
                traceback.print_exc()

            return {'success': True}


        @self.app.post('/api/v1/auth/password/reset')
        def reset_password():
            #self.get_user_or_raise()
            if not self.access.is_anon():
                return self._raise_error(403, 'already_logged_in')

            data = request.json or {}

            password = data.get('newPass', '')
            confirm_password = data.get('newPass2', '')
            reset_code = data.get('resetCode', '')
            rkey = 'reset:{}'.format(self._get_remote_ip())

            tries = self.user_manager.redis.get(rkey)
            if tries is not None and int(tries) > 3:
                response.status = 429
                return {'error': 'too_many_attempts'}

            try:
                self.user_manager.reset_password(password, confirm_password, reset_code)
                return {'success': True}
            except ValidationException as ve:
                self.user_manager.redis.incr(rkey)
                self.user_manager.redis.expire(rkey, 15 * 60)
                self._raise_error(403, str(ve))

        @self.app.post('/api/v1/auth/password/update')
        def update_password():
            self.access.assert_is_logged_in()

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
            return self.load_user(username)

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
            user = self.get_user_or_raise(username=username)

            data = request.json or {}

            if 'desc' in data:
                user['desc'] = data['desc']

            if 'full_name' in data:
                user['full_name'] = data['full_name'][:150]

            if 'display_url' in data:
                user['display_url'] = data['display_url'][:500]

            return {'success': True}
