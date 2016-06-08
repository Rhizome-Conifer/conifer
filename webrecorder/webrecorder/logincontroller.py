from bottle import request
from os.path import expandvars

from webrecorder.webreccork import ValidationException
from webrecorder.basecontroller import BaseController
import json


# ============================================================================
LOGIN_PATH = '/_login'

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
            return {}

        @self.app.post(LOGIN_PATH)
        def login_post():
            self.redirect_home_if_logged_in()

            """Authenticate users"""
            username = self.post_get('username')
            password = self.post_get('password')

            if self.manager.cork.login(username, password):
                redir_to = self.get_redir_back((LOGIN_PATH, '/'), self.get_path(username))
                #host = request.headers.get('Host', 'localhost')
                #request.environ['beaker.session'].domain = '.' + host.split(':')[0]
                #request.environ['beaker.session'].path = '/'
            else:
                self.flash_message('Invalid Login. Please Try Again')
                redir_to = LOGIN_PATH

            request.environ['webrec.delete_all_cookies'] = 'non_sesh'
            self.redirect(redir_to)

        @self.app.get(LOGOUT_PATH)
        def logout():
            #redir_to = get_redir_back(LOGOUT_PATH, '/')
            redir_to = '/'
            request.environ['webrec.delete_all_cookies'] = 'all'
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

            invitecode = request.query.get('invite', '')
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

            email = self.post_get('email', '')
            name = self.post_get('name', '')
            desc = self.post_get('desc', '')
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
            confirm_password = self.post_get('confirmpassword')
            invitecode = self.post_get('invite')

            move_temp = self.post_get('move-temp')

            if move_temp == '1':
                to_coll_title = self.post_get('to-coll')
                to_coll = self.sanitize_title(to_coll_title)
            else:
                to_coll = None

            redir_to = REGISTER_PATH

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

                init_info = None

                sesh = self.get_session()

                if sesh.is_anon() and to_coll:
                    init_info = {'from_user': sesh.anon_user,
                                 'to_coll': to_coll,
                                 'to_title': to_coll_title,
                                }
                    init_info = json.dumps(init_info)

                self.manager.cork.register(username, password, email, role='archivist',
                              max_level=50,
                              subject='webrecorder.io Account Creation',
                              email_template='templates/emailconfirm.html',
                              description=init_info,
                              host=host)

                self.flash_message('A confirmation e-mail has been sent to <b>{0}</b>. \
    Please check your e-mail to complete the registration!'.format(username), 'success')

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

            email = self.post_get('email', None)
            username = self.post_get('username', None)
            host = self.get_host()

            try:
                self.manager.cork.send_password_reset_email(username=username,
                                          email_addr=email,
                                          subject='webrecorder.io password reset confirmation',
                                          email_template='templates/emailreset.html',
                                          host=host)

                self.flash_message('A password reset e-mail has been sent to your e-mail!',
                              'success')

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
