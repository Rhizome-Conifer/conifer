from bottle import route, request, response, post, default_app
from bottle import redirect, run, HTTPError, HTTPResponse
from bottle import hook, error

from cork import Cork, AAAException

from redis import StrictRedis

from pywb.utils.loaders import load_yaml_config
from pywb.webapp.views import J2TemplateView
from pywb.framework.wbrequestresponse import WbRequest

from manager import init_cork, CollsManager, ValidationException
from pywb_dispatcher import PywbDispatcher

from pywb_handlers import DynRedisResolver
from jinja2 import contextfunction

from pathparser import WebRecPathParser
from uploader import Uploader, AnonChecker, iter_all_accounts

from warcsigner.warcsigner import RSASigner
from session import Session, flash_message

import logging
import functools

from urlparse import urljoin
from os.path import expandvars


# ============================================================================
# App Init
def init(configfile='config.yaml', redis_url=None):
    logging.basicConfig(format='%(asctime)s: [%(levelname)s]: %(message)s',
                        level=logging.DEBUG)
    logging.debug('')

    # set boto log to error
    boto_log = logging.getLogger('boto')
    if boto_log:
        boto_log.setLevel(logging.ERROR)

    config = load_yaml_config(configfile)

    if not redis_url:
        redis_url = expandvars(config['redis_url'])

    redis_obj = StrictRedis.from_url(redis_url)

    config['redis_warc_resolver'] = DynRedisResolver(redis_obj,
                                                     remote_target=config['remote_target'],
                                                     proxy_target=config['proxy_target'])


    bottle_app = default_app()

    final_app, cork = init_cork(bottle_app, redis_obj, config)

    webrec = WebRec(config, cork, redis_obj)
    bottle_app.install(webrec)

    pywb_dispatch = PywbDispatcher(bottle_app)

    init_routes(webrec)
    pywb_dispatch.init_routes()

    return final_app


# =============================================================================
class WebRec(object):
    name = 'webrecorder'
    api = 2

    def __init__(self, config, cork, redis_obj):
        store_root = config.get('store_root', './')

        self.path_parser = WebRecPathParser(store_root)
        self.cork = cork
        self.config = config

        storage_manager = self._init_default_storage(config)

        signer = RSASigner(private_key_file=expandvars(config['warcsign_private_key']),
                           public_key_file=expandvars(config['warcsign_public_key']))

        manager = CollsManager(cork, redis_obj, self.path_parser, storage_manager, signer)
        self.manager = manager

        jinja_env.globals['metadata'] = config.get('metadata', {})

        @contextfunction
        def can_admin(context):
            return manager.can_admin_coll(context.get('user', ''), context.get('coll', ''))

        @contextfunction
        def is_owner(context):
            return manager.is_owner(context.get('user', ''))

        @contextfunction
        def can_write(context):
            return manager.can_write_coll(context.get('user', ''), context.get('coll', ''))

        @contextfunction
        def can_read(context):
            return manager.can_read_coll(context.get('user', ''), context.get('coll', ''))

        @contextfunction
        def is_anon(context):
            return context.get('coll') == '@anon'

        jinja_env.globals['can_admin'] = can_admin
        jinja_env.globals['can_write'] = can_write
        jinja_env.globals['can_read'] = can_read
        jinja_env.globals['is_owner'] = is_owner
        jinja_env.globals['is_anon'] = is_anon

        @jinja2_view('error.html')
        def err_handler(out):
            if out.status_code == 404:
                if self.check_refer_redirect():
                    return
            else:
                response.status = 404

            return {'err': out}

        self.invites_enabled = config.get('invites_enabled', True)

        self.anon_duration = config.get('anon_duration', True)

        self.err_handler = err_handler

        self.uploader = Uploader(store_root,
                                 storage_manager,
                                 signer,
                                 redis_obj,
                                 iter_all_accounts)

        self.anon_checker = AnonChecker(store_root,
                                        manager,
                                        config['session_opts'])

    def _init_default_storage(self, config):
        store_type = config.get('default_storage', 'local')

        storage = config['storage']

        store_class = storage.get(store_type)

        return store_class(expandvars(config['storage_remote_root']))


    def setup(self, app):
        app.default_error_handler = self.err_handler

        app.webrec = self

        start_uwsgi_timer(30, "mule", self.run_timer)


    def run_timer(self, signum=None):
        self.anon_checker()
        self.uploader()

    def check_refer_redirect(self):
        referer = request.headers.get('Referer')
        if not referer:
            return

        host = request.headers.get('Host')
        if host not in referer:
            return

        inx = referer[1:].find('http')
        if not inx:
            inx = referer[1:].find('///')
            if inx > 0:
                inx + 1

        if inx < 0:
            return

        url = referer[inx + 1:]
        host = referer[:inx + 1]

        orig_url = request.urlparts.path
        if request.urlparts.query:
            orig_url += '?' + request.urlparts.query

        full_url = host + urljoin(url, orig_url)
        response.status = 302
        response.set_header('Location', full_url)
        return True

    def __call__(self, func):
        def func_wrapper(*args, **kwargs):
            request.environ['webrec.session'] = Session(self.cork, self.anon_duration)
            return func(*args, **kwargs)

        return func_wrapper


# =============================================================================
def start_uwsgi_timer(freq, type_, callable_):
    import uwsgi
    uwsgi.register_signal(66, type_, callable_)
    uwsgi.add_timer(66, freq)

def raise_uwsgi_signal():
    import uwsgi
    uwsgi.signal(66)


#=================================================================
jinja_env = J2TemplateView.init_shared_env()

def jinja2_view(template_name):
    def decorator(view_func):
        @functools.wraps(view_func)
        def wrapper(*args, **kwargs):
            response = view_func(*args, **kwargs)

            if isinstance(response, dict):
                ctx_params = request.environ.get('pywb.template_params')
                if ctx_params:
                    response.update(ctx_params)

                template = jinja_env.get_or_select_template(template_name)
                return template.render(**response)
            else:
                return response

        return wrapper

    return decorator


## ============================================================================
# Utilities
def get_redir_back(skip, default='/'):
    redir_to = request.headers.get('Referer', default)
    if redir_to.endswith(skip):
        redir_to = default
    return redir_to


def post_get(name, default=''):
    res = request.POST.get(name, default).strip()
    if not res:
        res = default
    return res

def get_host():
    return WbRequest.make_host_prefix(request.environ)


# ============================================================================
LOGIN_PATH = '/_login'
LOGOUT_PATH = '/_logout'
CREATE_PATH = '/_create'

REGISTER_PATH = '/_register'
VAL_REG_PATH = '/_valreg/:reg'
INVITE_PATH = '/_invite'

FORGOT_PATH = '/_forgot'

RESET_POST = '/_resetpassword'
RESET_PATH = '/_resetpassword/:resetcode'
RESET_PATH_FILL = '/_resetpassword/{0}?username={1}'

UPDATE_PASS_PATH = '/_updatepassword'
SETTINGS = '/_settings'


# TODO: move these to external file for customization, localization, etc..
DEFAULT_DESC = u"""

#### About {0}

*This collection doesn't yet have a description*

Click on the **Records** tab to browse through any recorded content.

Happy Recording!

"""

ANON_DESC = u"""
This is an temporary anonymous collection created in Webrecorder.

*These recordings are accessible only to you and the contents will be deleted
automatically in 30 min*.

* To view recorded pages, visit [Records](#records)

* If you wish to keep this data, please other [Download the WARCs](#files).

* If you would like a permanent account, please [Register](/_register).

* To *immediately* delete any temporary recordings, visit [Settings](#settings)

"""

ANON_TITLE = "Webrecorder Test Collection"


DEFAULT_USER_DESC = u"""
## {0} archive

Available Collections:
"""

def init_routes(webrec):
    invites_enabled = webrec.invites_enabled
    path_parser = webrec.path_parser

    user_path = path_parser.get_user_path_template()
    coll_path = path_parser.get_coll_path_template()

    cork = webrec.cork
    manager = webrec.manager


    # Login/Logout
    # ============================================================================
    @route(LOGIN_PATH)
    @jinja2_view('login.html')
    def login():
        return {}


    @post(LOGIN_PATH)
    def login_post():
        """Authenticate users"""
        username = post_get('username')
        password = post_get('password')

        if cork.login(username, password):
            redir_to = get_redir_back(LOGIN_PATH, path_parser.get_user_home(username))
            #host = request.headers.get('Host', 'localhost')
            #request.environ['beaker.session'].domain = '.' + host.split(':')[0]
            #request.environ['beaker.session'].path = '/'
        else:
            flash_message('Invalid Login. Please Try Again')
            redir_to = LOGIN_PATH

        request.environ['webrec.delete_all_cookies'] = 'non_sesh'
        redirect(redir_to)

    @route(LOGOUT_PATH)
    def logout():
        #redir_to = get_redir_back(LOGOUT_PATH, '/')
        redir_to = '/'
        request.environ['webrec.delete_all_cookies'] = 'all'
        cork.logout(success_redirect=redir_to, fail_redirect=redir_to)



    # Register/Invite/Confirm
    # ============================================================================
    @route(REGISTER_PATH)
    @jinja2_view('register.html')
    def register():
        if not invites_enabled:
            return {'email': '',
                    'skip_invite': True}

        invitecode = request.query.get('invite', '')
        email = ''

        try:
            email = manager.is_valid_invite(invitecode)
        except ValidationException as ve:
            flash_message(str(ve))

        return { 'email': email,
                 'invite': invitecode}

    @post(INVITE_PATH)
    def invite_post():
        email = post_get('email', '')
        name = post_get('name', '')
        desc = post_get('desc', '')
        if manager.save_invite(email, name, desc):
            flash_message('Thank you for your interest! We will send you an invite to try beta.webrecorder.io soon!', 'success')
            redirect('/')
        else:
            flash_message('Oops, something went wrong, please try again')
            redirect(REGISTER_PATH)

    @post(REGISTER_PATH)
    def register_post():
        email = post_get('email')
        username = post_get('username')
        password = post_get('password')
        confirm_password = post_get('confirmpassword')
        invitecode = post_get('invite')

        redir_to = REGISTER_PATH

        if invites_enabled:
            try:
                val_email = manager.is_valid_invite(invitecode)
                if val_email != email:
                    raise ValidationException('Sorry, this invite can only be used with email: {0}'.format(val_email))
            except ValidationException as ve:
                flash_message(str(ve))
                redirect(redir_to)
                return

            redir_to += '?invite=' + invitecode


        try:
            manager.validate_user(username, email)
            manager.validate_password(password, confirm_password)

            #TODO: set default host?
            host = get_host()

            cork.register(username, password, email, role='archivist',
                          max_level=50,
                          subject='webrecorder.io Account Creation',
                          email_template='templates/emailconfirm.html',
                          host=host)

            flash_message('A confirmation e-mail has been sent to <b>{0}</b>. \
Please check your e-mail to complete the registration!'.format(username), 'success')

            redir_to = '/'
            if invites_enabled:
                manager.delete_invite(email)

        except ValidationException as ve:
            flash_message(str(ve))

        except Exception as ex:
            flash_message('Registration failed: ' + str(ex))

        redirect(redir_to)


    # Validate Registration
    @route(VAL_REG_PATH)
    def val_reg(reg):
        try:
            username = manager.init_user(reg)

            flash_message('<b>{0}</b>, welcome to your new archive home page! \
Click the <b>Create New Collection</b> button to create your first collection. Happy Archiving!'.format(username), 'success')
            redir_to = '/' + username

        except AAAException:
            flash_message('The user <b>{0}</b> is already registered. \
If this is you, please login or click forgot password, \
or register a new account.'.format(username))
            redir_to = LOGIN_PATH

        except Exception as e:
            flash_message('Sorry, this is not a valid registration code. Please try again.')
            redir_to = REGISTER_PATH

        redirect(redir_to)


    # Forgot Password
    # ============================================================================
    @route(FORGOT_PATH)
    @jinja2_view('forgot.html')
    def forgot():
        return {}


    @post(FORGOT_PATH)
    def forgot_submit():
        email = post_get('email', None)
        username = post_get('username', None)
        host = get_host()

        try:
            cork.send_password_reset_email(username=username,
                                      email_addr=email,
                                      subject='webrecorder.io password reset confirmation',
                                      email_template='templates/emailreset.html',
                                      host=host)

            flash_message('A password reset e-mail has been sent to your e-mail!',
                          'success')

            redir_to = '/'
        except Exception as e:
            flash_message(str(e))
            redir_to = FORGOT_PATH

        redirect(redir_to)


    # Reset Password
    # ============================================================================
    @route(RESET_PATH)
    @jinja2_view('reset.html')
    def resetpass(resetcode):
        try:
            username = request.query['username']
            result = {'username': username,
                      'resetcode': resetcode}

        except Exception as e:
            print(e)
            flash_message('Invalid password reset attempt. Please try again')
            redirect(FORGOT_PATH)

        return result


    @post(RESET_POST)
    def do_reset():
        username = post_get('username')
        resetcode = post_get('resetcode')
        password = post_get('password')
        confirm_password = post_get('confirmpassword')

        try:
            manager.validate_password(password, confirm_password)

            cork.reset_password(resetcode, password)

            flash_message('Your password has been successfully reset! \
You can now <b>login</b> with your new password!', 'success')

            redir_to = LOGIN_PATH

        except ValidationException as ve:
            flash_message(str(ve))
            redir_to = RESET_PATH_FILL.format(resetcode, username)

        except Exception as e:
            flash_message('Invalid password reset attempt. Please try again')
            redir_to = FORGOT_PATH

        redirect(redir_to)


    # Update Password
    @post(UPDATE_PASS_PATH)
    def update_password():
        cork.require(role='archivist', fail_redirect=LOGIN_PATH)

        curr_password = post_get('curr_password')
        password = post_get('password')
        confirm_password = post_get('confirmpassword')

        try:
            manager.update_password(curr_password, password, confirm_password)
            flash_message('Password Updated', 'success')
        except ValidationException as ve:
            flash_message(str(ve))

        user = manager.get_curr_user()
        redirect(path_parser.get_user_home(user) + SETTINGS)


    # Create Coll
    # ============================================================================
    @route(CREATE_PATH)
    @jinja2_view('create.html')
    def create_coll_static():
        try:
            cork.require(role='archivist')
        except AAAException:
            msg = "You must login to create a new collection"
            flash_message(msg)
            redirect('/')

        try:
            manager.has_more_colls()
        except ValidationException as ve:
            flash_message(str(ve))
            user = cork.current_user.username
            redirect(path_parser.get_user_home(user))

        return {}


    @post(CREATE_PATH)
    def create_coll():
        cork.require(role='archivist', fail_redirect=LOGIN_PATH)

        coll_name = post_get('collection')
        title = post_get('title', coll_name)
        access = post_get('public', 'private')

        user = manager.get_curr_user()

        try:
            manager.add_collection(user, coll_name, title, access)
            flash_message('Created collection <b>{0}</b>!'.format(coll_name), 'success')
            redir_to = path_parser.get_coll_path(user, coll_name)
        except ValidationException as ve:
            flash_message(str(ve))
            redir_to = CREATE_PATH

        redirect(redir_to)

    # ============================================================================
    # Delete Collection
    @post('/_delete_coll')
    def delete_coll():
        coll = request.query.get('coll', '')
        if coll == '@anon':
            user = manager.get_anon_user()

            if manager.delete_anon_user(user):
                #request.environ['webrec.delete_all_cookies'] = 'all'
                #flash_message('Anonymous collection has been deleted!', 'success')
                redirect('/')
            else:
                flash_message('There was an error deleting this collection')
                redirect('/replay#settings')

        else:
            cork.require(role='archivist', fail_redirect=LOGIN_PATH)
            user, coll = path_parser.get_user_coll(coll)

            if manager.delete_collection(user, coll):
                flash_message('Collection {0} has been deleted!'.format(coll), 'success')
                redirect('/' + path_parser.get_user_home(user))
            else:
                flash_message('There was an error deleting {0}'.format(coll))
                redirect('/' + path_parser.get_coll_path(user, coll) + '#settings')


    # ============================================================================
    # Delete User
    @post('/_delete_account')
    def delete_account():
        cork.require(role='archivist', fail_redirect=LOGIN_PATH)

        user = request.query.get('user', '')
        if manager.delete_user(user):
            flash_message('The user {0} has been permanently deleted!'.format(user), 'success')

            redir_to = '/'
            request.environ['webrec.delete_all_cookies'] = 'all'
            cork.logout(success_redirect=redir_to, fail_redirect=redir_to)
        else:
            flash_message('There was an error deleting {0}'.format(coll))
            redirect('/' + path_parser.get_user_home(user))


    # ============================================================================
    # Banner
    @route('/banner')
    @jinja2_view('banner_page.html')
    def banner():
        path = request.query.get('coll', '')
        user, coll = path_parser.get_user_coll(path)
        return {'user': user,
                'coll': coll,
                'path': path,
                'state': request.query.get('state')}


    # Home Page
    # ============================================================================
    @route(['/', '/index.html'])
    @jinja2_view('index.html')
    def home_page():
        return {}


    # User Page
    # ============================================================================
    @route([user_path, user_path + '/', user_path + '/index.html'])
    @jinja2_view('user.html')
    def user_page(user=None):
        if user:
            if not manager.has_user(user):
                raise HTTPError(status=404, body='No Such Archive')

            path = user
            desc = manager.get_user_metadata(user, 'desc')
            total_size = manager.get_user_metadata(user, 'total_len')
        else:
            user = 'default'
            path = '/'
            desc = None
            total_size = 0

        if not desc:
            desc = DEFAULT_USER_DESC.format(user)

        return {'path': path,
                'user': user,
                'colls': manager.list_collections(user),
                'desc': desc,
                'total_size': total_size,
               }


    # User Settings
    # ============================================================================
    @route([user_path + SETTINGS])
    @jinja2_view('account.html')
    def settings(user):
        info = manager.get_user_info(user)
        if not info:
            raise HTTPError(status=404, body='No Such Collection')

        info['user'] = user
        info['coll'] = 'Account Settings'
        info['path'] = user + SETTINGS
        return info

    # ============================================================================
    # Collection View
    @route([coll_path, coll_path + '/'])
    @jinja2_view('search.html')
    def coll_page(user, coll):
        if not manager.can_read_coll(user, coll):
            raise HTTPError(status=404, body='No Such Collection')

        title = manager.get_metadata(user, coll, 'title')
        if not title:
            title = coll

        desc = manager.get_metadata(user, coll, 'desc')
        if not desc:
            desc = DEFAULT_DESC.format(title)

        collinfo = manager.get_info(user, coll)
        is_public = manager.is_public(user, coll)
        path = path_parser.get_coll_path(user, coll)

        return {'user': user,
                'coll': coll,

                'coll_id': path,
                'path': path,

                'is_public': is_public,
                'title': title,
                'desc': desc,

                'coll_size': collinfo.get('total_size')
               }


    @route(['/replay', '/replay/'])
    @jinja2_view('search.html')
    def anon_coll_page():
        user = manager.get_curr_user()
        # Anon coll page only available when not logged in
        if user:
            flash_message('Please select a collection to view', 'info')
            redirect('/' + path_parser.get_user_home(user))

        user = manager.get_anon_user()
        collinfo = manager.get_info(user, '@anon')

        return {'user': '',
                'coll': '@anon',

                'coll_id': '@anon',
                'path': 'replay',

                'is_public': False,
                'title': ANON_TITLE,
                'desc': ANON_DESC,

                'coll_size': collinfo.get('total_size')
               }


    # Toggle Public
    # ============================================================================
    @route(['/_setaccess'])
    def setaccess():
        user, coll = path_parser.get_user_coll(request.query['coll'])
        public = request.query['public'] == 'true'
        if manager.set_public(user, coll, public):
            return {}
        else:
            raise HTTPError(status=403, body='No permission to change')


    # Pages
    # ============================================================================
    @post(['/_addpage'])
    def add_page():
        coll = request.query.get('coll')
        if coll.startswith('@anon'):
            user = manager.get_anon_user()
        else:
            cork.require(role='archivist', fail_redirect=LOGIN_PATH)
            user, coll = path_parser.get_user_coll(request.query['coll'])

        data = {}
        for item in request.forms:
            data[item] = request.forms.get(item)

        manager.add_page(user, coll, data)
        return {}

    @route('/_listpages')
    def list_pages():
        coll = request.query.get('coll')
        if coll.startswith('@anon'):
            user = manager.get_anon_user()
        else:
            user, coll = path_parser.get_user_coll(coll)
        pagelist = manager.list_pages(user, coll)

        return {"data": pagelist}


    # User Desc
    # ============================================================================
    @post('/_desc/:user')
    def set_desc(user):
        if manager.set_user_metadata(user, 'desc', request.body.read()):
            return {}
        else:
            raise HTTPError(status=404, body='Not found')


    # Coll Desc
    # ============================================================================
    @post('/_desc/:user/:coll')
    def set_desc(user, coll):
        if manager.set_metadata(user, coll, 'desc', request.body.read()):
            return {}
        else:
            raise HTTPError(status=404, body='Not found')


    # ============================================================================
    # Set Title
    @route('/_settitle')
    def set_title():
        path = request.query.get('coll', '')
        user, coll = path_parser.get_user_coll(path)
        title = request.query.get('title', '')
        if manager.set_metadata(user, coll, 'title', title):
            return {}
        else:
            raise HTTPError(status=404, body='Not found')

    # Info
    # ============================================================================
    @route('/_info')
    def info():
        coll = request.query.get('coll')
        if coll == '@anon':
            user = manager.get_anon_user()
        else:
            user, coll = path_parser.get_user_coll(coll)
        info = manager.get_info(user, coll)
        return info


    # Report Issues
    # ============================================================================
    @post('/_reportissues')
    def report_issues():
        #try:
        #    cork.require(role='archivist')
        #except AAAException:
        #    raise HTTPError(status=404, body='Requires Login')
        useragent = request.headers.get('User-Agent')
        manager.report_issues(request.POST, useragent)
        return {}

    # Skip POST request recording
    # ============================================================================
    @route('/_skipreq')
    def skip_req():
        url = request.query.get('url')
        user = manager.get_curr_user()
        if not user:
            user = manager.get_anon_user()

        manager.skip_post_req(user, url)
        return {}


    # Queue
    # ============================================================================
    @route('/_queue/<user/<coll>')
    def get_queue(user, coll):
        return manager.get_from_queue(user, coll)


    @post('/_queue/<user>/<coll>')
    def rec_queue(user, coll):
        data = request.json
        res = manager.add_to_queue(user, coll, data)
        return res


    # WARC Files -- List
    # ============================================================================
    @route('/_files')
    def list_warcs():
        coll = request.query.get('coll')
        if coll.startswith('@anon'):
            user = manager.get_anon_user()
        else:
            user, coll = path_parser.get_user_coll(coll)

        warcs = manager.list_warcs(user, coll)
        return {'data': warcs}


    # WARC Files -- Download
    # ============================================================================
    @route('/_dlwarc')
    def download_warcs():
        coll = request.query.get('coll')
        if coll.startswith('@anon'):
            user = manager.get_anon_user()
        else:
            user, coll = path_parser.get_user_coll(coll)

        warc = request.query['warc']

        res = manager.download_warc(user, coll, warc)

        if not res:
            raise HTTPError(status=404, body='No Such WARC')

        length, body = res
        response.headers['Content-Type'] = 'text/plain'
        response.headers['Content-Disposition'] = 'attachment; filename=' + warc
        response.headers['Content-Length'] = length
        response.body = body
        return response
