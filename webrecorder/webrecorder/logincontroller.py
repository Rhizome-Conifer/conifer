from bottle import request
from os.path import expandvars

from webrecorder.webreccork import ValidationException
from webrecorder.basecontroller import BaseController
import json


# ============================================================================
LOGIN_PATH = '/_login'
LOGIN_MODAL_PATH = '/_login_modal'

LOGOUT_PATH = '/_logout'
CREATE_PATH = '/_create'

REGISTER_PATH = '/_register'
VAL_REG_PATH = '/_valreg/<reg>'
INVITE_PATH = '/_invite'

FORGOT_PATH = '/_forgot'

RESET_POST = '/_resetpassword'
RESET_PATH = '/_resetpassword/<resetcode>'
RESET_PATH_FILL = '/_resetpassword/{0}?username={1}'

UPDATE_PASS_PATH = '/_updatepassword'
SETTINGS = '/_settings'


# ============================================================================
class LoginController(BaseController):
    def __init__(self, *args, **kwargs):
        config = kwargs.get('config')

        invites = expandvars(config.get('invites_enabled', 'true')).lower()
        self.invites_enabled = invites in ('true', '1', 'yes')

        super(LoginController, self).__init__(*args, **kwargs)

    def init_routes(self):
        # Login/Logout
        # ============================================================================
        @self.app.get(LOGIN_PATH)
        @self.jinja2_view('login.html')
        def login():
            self.redirect_home_if_logged_in()
            resp = {}
            self.fill_anon_info(resp)
            return resp

        @self.app.get(LOGIN_MODAL_PATH)
        @self.jinja2_view('login_modal.html')
        def login_modal():
            #self.redirect_home_if_logged_in()
            resp = {}
            self.fill_anon_info(resp)
            return resp

        @self.app.post(LOGIN_PATH)
        def login_post():
            self.redirect_home_if_logged_in()

            """Authenticate users"""
            username = self.post_get('username')
            password = self.post_get('password')

            try:
                move_info = self.get_move_temp_info()
            except ValidationException as ve:
                self.flash_message('Login Failed: ' + str(ve))
                self.redirect('/')
                return

            # if a collection is being moved, auth user
            # and then check for available space
            # if not enough space, don't continue with login
            if move_info and (self.manager.cork.
                              is_authenticate(username, password)):

                if not self.manager.has_space_for_new_coll(username,
                                                           move_info['from_user'],
                                                           'temp'):
                    self.flash_message('Sorry, not enough space to import this Temporary Collection into your account.')
                    self.redirect('/')
                    return

            if self.manager.cork.login(username, password):
                sesh = self.get_session()
                sesh.curr_user = username

                if move_info:
                    try:
                        new_title = self.manager.move_temp_coll(username, move_info)
                        if new_title:
                            self.flash_message('Collection <b>{0}</b> created!'.format(new_title), 'success')
                    except:
                        import traceback
                        traceback.print_exc()

                remember_me = (self.post_get('remember_me') == '1')
                sesh.logged_in(remember_me)

                redir_to = request.headers.get('Referer')
                host = self.get_host()

                temp_prefix = self.manager.temp_prefix

                if not redir_to or redir_to.startswith((host + '/' + temp_prefix,
                                                        host + '/_')):
                    redir_to = self.get_path(username)

            else:
                self.flash_message('Invalid Login. Please Try Again')
                redir_to = LOGIN_PATH

            self.redirect(redir_to)

        @self.app.get(LOGOUT_PATH)
        def logout():
            redir_to = '/'
            self.manager.cork.logout(success_redirect=redir_to, fail_redirect=redir_to)


        # Register/Invite/Confirm
        # ============================================================================
        @self.app.get(REGISTER_PATH)
        @self.jinja2_view('register.html')
        def register():
            self.redirect_home_if_logged_in()

            if not self.invites_enabled:
                resp = {'email': '',
                        'skip_invite': True}

                self.fill_anon_info(resp)

                return resp

            invitecode = request.query.getunicode('invite', '')
            email = ''

            try:
                email = self.manager.is_valid_invite(invitecode)
            except ValidationException as ve:
                self.flash_message(str(ve))

            return { 'email': email,
                     'invite': invitecode}

        @self.app.post(INVITE_PATH)
        def invite_post():
            self.redirect_home_if_logged_in()

            email = self.post_get('email')
            name = self.post_get('name')
            desc = self.post_get('desc')
            if self.manager.save_invite(email, name, desc):
                self.flash_message('Thank you for your interest! We will send you an invite to try webrecorder.io soon!', 'success')
                self.redirect('/')
            else:
                self.flash_message('Oops, something went wrong, please try again')
                self.redirect(REGISTER_PATH)


        @self.app.post(REGISTER_PATH)
        def register_post():
            self.redirect_home_if_logged_in()

            email = self.post_get('email')
            username = self.post_get('username')
            password = self.post_get('password')
            name = self.post_get('name')
            confirm_password = self.post_get('confirmpassword')
            invitecode = self.post_get('invite')

            redir_to = REGISTER_PATH

            if username.startswith(self.manager.temp_prefix):
                self.flash_message('Sorry, this is not a valid username')
                self.redirect(redir_to)
                return

            try:
                move_info = self.get_move_temp_info()
            except ValidationException as ve:
                self.flash_message('Registration Failed: ' + str(ve))
                self.redirect('/')
                return

            if self.invites_enabled:
                try:
                    val_email = self.manager.is_valid_invite(invitecode)
                    if val_email != email:
                        raise ValidationException('Sorry, this invite can only be used with email: {0}'.format(val_email))
                except ValidationException as ve:
                    self.flash_message(str(ve))
                    self.redirect(redir_to)
                    return

                redir_to += '?invite=' + invitecode

            try:
                self.manager.validate_user(username, email)
                self.manager.validate_password(password, confirm_password)

                #TODO: set default host?
                host = self.get_host()

                desc = {'name': name}

                if move_info:
                    desc['move_info'] = move_info

                desc = json.dumps(desc)

                self.manager.cork.register(username, password, email, role='archivist',
                              max_level=50,
                              subject='webrecorder.io Account Creation',
                              email_template='templates/emailconfirm.html',
                              description=desc,
                              host=host)

                self.flash_message('A confirmation e-mail has been sent to <b>{0}</b>. \
    Please check your e-mail to complete the registration!'.format(username), 'warning')

                redir_to = '/'
                if self.invites_enabled:
                    self.manager.delete_invite(email)

            except ValidationException as ve:
                self.flash_message(str(ve))

            except Exception as ex:
                self.flash_message('Registration failed: ' + str(ex))

            self.redirect(redir_to)

        # Validate Registration
        @self.app.get(VAL_REG_PATH)
        def val_reg(reg):
            self.redirect_home_if_logged_in()

            try:
                username, first_coll = self.manager.create_user(reg)

                #self.flash_message('<b>{0}</b>, welcome to your new archive home page! \
    #Click the <b>Create New Collection</b> button to create your first collection. Happy Archiving!'.format(username), 'success')
                #redir_to = '/' + username

                msg = '<b>{0}</b>, you are now logged in!'

                if first_coll == 'Default Collection':
                    msg += ' The <b>{1}</b> collection has been created for you, and you can begin recording by entering a url below!'
                else:
                    msg += ' The <b>{1}</b> collection has been permanently saved for you, and you can continue recording by entering a url below!'

                self.flash_message(msg.format(username, first_coll), 'success')
                redir_to = '/'

            except ValidationException:
                self.flash_message('The user <b>{0}</b> is already registered. \
    If this is you, please login or click forgot password, \
    or register a new account.'.format(username))
                redir_to = LOGIN_PATH

            except Exception as e:
                import traceback
                traceback.print_exc()
                self.flash_message('Sorry, this is not a valid registration code. Please try again.')
                redir_to = REGISTER_PATH

            self.redirect(redir_to)


        # Forgot Password
        # ============================================================================
        @self.app.get(FORGOT_PATH)
        @self.jinja2_view('forgot.html')
        def forgot():
            self.redirect_home_if_logged_in()
            return {}


        @self.app.post(FORGOT_PATH)
        def forgot_submit():
            self.redirect_home_if_logged_in()

            email = self.post_get('email')
            username = self.post_get('username')
            host = self.get_host()

            try:
                self.manager.cork.send_password_reset_email(username=username,
                                          email_addr=email,
                                          subject='webrecorder.io password reset confirmation',
                                          email_template='templates/emailreset.html',
                                          host=host)

                self.flash_message('A password reset e-mail has been sent to your e-mail!', 'success')
                redir_to = '/'
            except Exception as e:
                self.flash_message(str(e))
                redir_to = FORGOT_PATH

            self.redirect(redir_to)


        # Reset Password
        # ============================================================================
        @self.app.get(RESET_PATH)
        @self.jinja2_view('reset.html')
        def resetpass(resetcode):
            self.redirect_home_if_logged_in()

            try:
                username = request.query['username']
                result = {'username': username,
                          'resetcode': resetcode}

            except Exception as e:
                print(e)
                self.flash_message('Invalid password reset attempt. Please try again')
                self.redirect(FORGOT_PATH)

            return result


        @self.app.post(RESET_POST)
        def do_reset():
            self.redirect_home_if_logged_in()

            username = self.post_get('username')
            resetcode = self.post_get('resetcode')
            password = self.post_get('password')
            confirm_password = self.post_get('confirmpassword')

            try:
                self.manager.validate_password(password, confirm_password)

                self.manager.cork.reset_password(resetcode, password)

                self.flash_message('Your password has been successfully reset! \
    You can now <b>login</b> with your new password!', 'success')

                redir_to = LOGIN_PATH

            except ValidationException as ve:
                self.flash_message(str(ve))
                redir_to = RESET_PATH_FILL.format(resetcode, username)

            except Exception as e:
                self.flash_message('Invalid password reset attempt. Please try again')
                redir_to = FORGOT_PATH

            self.redirect(redir_to)


        # Update Password
        @self.app.post(UPDATE_PASS_PATH)
        def update_password():
            self.redirect_home_if_logged_in()

            self.manager.cork.require(role='archivist', fail_redirect=LOGIN_PATH)

            curr_password = self.post_get('curr_password')
            password = self.post_get('password')
            confirm_password = self.post_get('confirmpassword')

            try:
                self.manager.update_password(curr_password, password, confirm_password)
                self.flash_message('Password Updated', 'success')
            except ValidationException as ve:
                self.flash_message(str(ve))

            user = self.manager.get_curr_user()
            self.redirect(self.get_path(user) + SETTINGS)

    def redirect_home_if_logged_in(self):
        sesh = self.get_session()

        if sesh.curr_user:
            self.flash_message('You are already logged in as <b>{0}</b>'.format(sesh.curr_user))
            self.redirect('/')

    def get_move_temp_info(self):
        move_info = None
        move_temp = self.post_get('move-temp')

        if move_temp == '1':
            to_coll_title = self.post_get('to-coll')
            to_coll = self.sanitize_title(to_coll_title)

            if not to_coll:
                raise ValidationException('Invalid new collection name, please pick a different name')

            sesh = self.get_session()

            if sesh.is_anon() and to_coll:
                move_info = {'from_user': sesh.anon_user,
                             'to_coll': to_coll,
                             'to_title': to_coll_title,
                            }

        return move_info


