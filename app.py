from bottle import route, request, response, post, default_app
from bottle import redirect, run, HTTPError, HTTPResponse
from bottle import hook, error

from cork import Cork, AAAException

from pywb.framework.wsgi_wrappers import WSGIApp
from pywb.manager.manager import CollectionsManager

from redis import StrictRedis

from pywb.webapp.pywb_init import create_wb_router
from pywb.utils.loaders import load_yaml_config
from pywb.webapp.views import J2TemplateView
from pywb.utils.wbexception import WbException
from pywb.framework.wbrequestresponse import WbRequest
from pywb.utils.timeutils import datetime_to_timestamp

from auth import init_cork, CollsManager, ValidationException

from loader import jinja_env, jinja2_view, DynRedisResolver
from jinja2 import contextfunction

from router import SingleUserRouter, MultiUserRouter
from uploader import S3Manager, Uploader, iter_all_accounts

from warcsigner.warcsigner import RSASigner

from rewriter import HTMLDomUnRewriter

import logging
import requests
import json
from datetime import datetime
from urlparse import urljoin


# ============================================================================
# App Init
application = None
cork = None
manager = None
redis_obj = None
pywb_router = None
warcprox_proxies = None


def init(configfile='config.yaml', store_root='./', redis_url=None):
    logging.basicConfig(format='%(asctime)s: [%(levelname)s]: %(message)s',
                        level=logging.DEBUG)
    logging.debug('')

    # set boto log to error
    boto_log = logging.getLogger('boto')
    if boto_log:
        boto_log.setLevel(logging.ERROR)

    bottle_app = default_app()

    config = load_yaml_config(configfile)

    global multiuser
    multiuser = config.get('multiuser', False)

    global router
    if multiuser:
        router = MultiUserRouter(store_root)
    else:
        router = SingleUserRouter(store_root)

    global redis_obj
    if not redis_url:
        redis_url = config['redis_url']

    redis_obj = StrictRedis.from_url(redis_url)

    global application
    global cork
    application, cork = init_cork(bottle_app, redis_obj, config)

    # for now, just s3
    s3_manager = S3Manager(config['s3_target'])

    signer = RSASigner(private_key_file=config['warcsign_private_key'],
                       public_key_file=config['warcsign_public_key'])

    global warcprox_proxies
    warcprox_proxies = {'http': config['proxy_path'],
                        'https': config['proxy_path']}

    global manager
    manager = CollsManager(cork, redis_obj, router, s3_manager, signer)

    jinja_env.globals['metadata'] = config.get('metadata', {})

    @contextfunction
    def can_admin(context):
        return manager.can_admin_coll(context['user'], context['coll'])

    @contextfunction
    def is_owner(context):
        return manager.is_owner(context['user'])

    @contextfunction
    def can_write(context):
        return manager.can_write_coll(context['user'], context['coll'])

    @contextfunction
    def can_read(context):
        return manager.can_read_coll(context['user'], context['coll'])

    jinja_env.globals['can_admin'] = can_admin
    jinja_env.globals['can_write'] = can_write
    jinja_env.globals['can_read'] = can_read
    jinja_env.globals['is_owner'] = is_owner

    config['redis_warc_resolver'] = DynRedisResolver(redis_obj,
                                                     s3_target=config['s3_target'],
                                                     proxy_target=config['proxy_target'])

    global pywb_router
    pywb_router = create_wb_router(config)

    @jinja2_view('error.html')
    @addcred()
    def err_handle(out):
        if out.status_code == 404:
            if test_refer_redirect():
                return
        else:
            response.status = 404

        return {'err': out}


    bottle_app.default_error_handler = err_handle
    create_coll_routes(router)

    uploader = Uploader(store_root,
                        s3_manager,
                        signer,
                        redis_obj,
                        iter_all_accounts)

    start_uwsgi_timer(30, "mule", uploader)

    return application


# =============================================================================
def test_refer_redirect():
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


# =============================================================================
def start_uwsgi_timer(freq, type_, callable_):
    import uwsgi
    uwsgi.register_signal(66, type_, callable_)
    uwsgi.add_timer(66, freq)

def raise_uwsgi_signal():
    import uwsgi
    uwsgi.signal(66)


## ============================================================================
# Utilities
def get_redir_back(skip, default='/'):
    redir_to = request.headers.get('Referer', default)
    print('REF: ' + redir_to)
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


def flash_message(msg, msg_type='danger'):
    sesh = request.environ.get('beaker.session')
    if sesh:
        sesh['message'] = msg_type + ':' + msg
        sesh.save()
    else:
        print('No Message')


def call_pywb(info=None, state=None):
    if info:
        request.path_shift(router.get_path_shift())
        request.environ['w_output_dir'] = router.get_archive_dir(info.user, info.coll)
        request.environ['w_sesh_id'] = info.path
        request.environ['w_manager'] = manager
        request.environ['w_user_id'] = 'u:' + info.user

        params = request.environ['pywb.template_params']
        params['state'] = state
        params['path'] = info.path
        params['user'] = info.user
        params['coll'] = info.coll

    try:
        resp = pywb_router(request.environ)
    except WbException as wbe:
        status = int(wbe.status().split(' ', 1)[0])
        raise HTTPError(status=status, body=str(wbe))

    if not resp:
        raise HTTPError(status=404, body='No Response Found')

    resp = HTTPResponse(body=resp.body,
                        status=resp.status_headers.statusline,
                        headers=resp.status_headers.headers)
    return resp


# ============================================================================
class addcred(object):
    def __init__(self, router=None):
        self.router = router

    def __call__(self, func):
        def func_wrapper(*args, **kwargs):
            sesh = request.environ.get('beaker.session')
            curr_user = None
            curr_role = None

            try:
                if not cork.user_is_anonymous:
                    curr_user = cork.current_user.username
                    curr_role = cork.current_user.role
            except Exception as e:
                print(e)
                print('SESH INVALID')
                if sesh:
                    sesh.delete()
                    #sesh.invalidate()

            message = ''
            msg_type = ''
            if sesh:
                message = sesh.get('message', '')
                if message:
                    sesh['message'] = ''
                    sesh.save()

                if ':' in message:
                    msg_type, message = message.split(':', 1)

            params = {'curr_user': curr_user,
                      'curr_role': curr_role,
                      'message': message,
                      'msg_type': msg_type}

            request.environ['pywb.template_params'] = params

            if self.router:
                res = func(self.router.get_state(kwargs), *args)
            else:
                res = func(*args, **kwargs)

            if isinstance(res, dict):
                res['curr_user'] = curr_user
                res['curr_role'] = curr_role
                res['message'] = message
                res['msg_type'] = msg_type

            return res

        return func_wrapper


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

DEFAULT_DESC = u"""

#### About {0}

*This collection doesn't yet have a description*

Click on the **Records** tab to browse through any recorded content.

Happy Recording!

"""

DEFAULT_USER_DESC = u"""
## {0} archive

Available Collections:
"""


# ============================================================================
def create_coll_routes(r):


    # Login/Logout
    # ============================================================================
    @route(LOGIN_PATH)
    @jinja2_view('login.html')
    @addcred()
    def login():
        return {}


    @post(LOGIN_PATH)
    def login_post():
        """Authenticate users"""
        username = post_get('username')
        password = post_get('password')

        if cork.login(username, password):
            redir_to = get_redir_back(LOGIN_PATH, r.user_home(username))
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
    @addcred()
    def register():
        invitecode = request.query.get('invite', '')
        email = None
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
    @addcred()
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
    @addcred()
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

        user, _ = manager.curr_user_role()
        redirect('/' + user + SETTINGS)


    # Create Coll
    # ============================================================================
    @route(CREATE_PATH)
    @jinja2_view('create.html')
    @addcred()
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
            redirect('/' + user)

        return {}


    @post(CREATE_PATH)
    def create_coll():
        cork.require(role='archivist', fail_redirect=LOGIN_PATH)

        coll_name = post_get('collection')
        title = post_get('title', coll_name)
        access = post_get('public', 'private')

        user, role = manager.curr_user_role()

        try:
            manager.add_collection(user, coll_name, title, access)
            flash_message('Created collection <b>{0}</b>!'.format(coll_name), 'success')
            redir_to = r.get_coll_path(user, coll_name)
        except ValidationException as ve:
            flash_message(str(ve))
            redir_to = CREATE_PATH

        redirect(redir_to)

    # ============================================================================
    # Delete Collection
    @post('/_delete_coll')
    def delete_coll():
        cork.require(role='archivist', fail_redirect=LOGIN_PATH)

        path = request.query.get('coll', '')
        user, coll = r.get_user_coll(path)
        if manager.delete_collection(user, coll):
            flash_message('Collection {0} has been deleted!'.format(coll), 'success')
            redirect('/' + user)
        else:
            flash_message('There was an error deleting {0}'.format(coll))
            redirect('/' + user + '/' + coll + '#settings')


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
            redirect('/' + user)


    # ============================================================================
    # Banner
    @route('/banner')
    @jinja2_view('banner_page.html')
    @addcred()
    def banner():
        path = request.query.get('coll', '')
        user, coll = r.get_user_coll(path)
        return {'user': user,
                'coll': coll,
                'path': path,
                'state': request.query.get('state')}


    # pywb static and home
    # ============================================================================
    @route(['/static/<:re:.*>'])
    def static():
        return call_pywb()


    # Shared Home Page
    # ============================================================================
    if multiuser:
        @route(['/', '/index.html'])
        @jinja2_view('index.html')
        @addcred()
        def shared_home_page():
            return {}

    # User Page
    # ============================================================================
    @route([r.USER, r.USER + '/', r.USER + '/index.html'])
    @jinja2_view('user.html')
    @addcred()
    def home_pages(user=None):
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
    @route([r.USER + SETTINGS])
    @jinja2_view('account.html')
    @addcred()
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
    @route([r.COLL, r.COLL + '/'])
    @jinja2_view('search.html')
    @addcred(router=r)
    def coll_page(info):
        if not manager.can_read_coll(info.user, info.coll):
            raise HTTPError(status=404, body='No Such Collection')

        title = manager.get_metadata(info.user, info.coll, 'title')
        if not title:
            title = info.coll

        desc = manager.get_metadata(info.user, info.coll, 'desc')
        if not desc:
            desc = DEFAULT_DESC.format(title)

        collinfo = manager.get_info(info.user, info.coll)
        is_public = manager.is_public(info.user, info.coll)

        return {'user': info.user,
                'coll': info.coll,
                'path': info.path,

                'is_public': is_public,
                'title': title,
                'desc': desc,

                'coll_size': collinfo.get('total_size')
               }

    #@route([r.COLL + '/record', r.COLL + '/record/'])
    @addcred(router=r)
    def record_redir(info):
        redirect('/' + info.path)


    # Toggle Public
    # ============================================================================
    @route(['/_setaccess'])
    def setaccess():
        user, coll = r.get_user_coll(request.query['coll'])
        public = request.query['public'] == 'true'
        if manager.set_public(user, coll, public):
            return {}
        else:
            raise HTTPError(status=403, body='No permission to change')


    # Pages
    # ============================================================================
    @post(['/_addpage'])
    def add_page():
        cork.require(role='archivist', fail_redirect=LOGIN_PATH)
        user, coll = r.get_user_coll(request.query['coll'])

        data = {}
        for item in request.forms:
            data[item] = request.forms.get(item)

        manager.add_page(user, coll, data)
        return {}

    @route('/_listpages')
    def list_pages():
        user, coll = r.get_user_coll(request.query['coll'])
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
        user, coll = r.get_user_coll(path)
        title = request.query.get('title', '')
        if manager.set_metadata(user, coll, 'title', title):
            return {}
        else:
            raise HTTPError(status=404, body='Not found')


    # Snapshot
    # ============================================================================
    @post('/_snapshot')
    def snapshot():
        path = request.query.get('coll', '')
        user, coll = r.get_user_coll(path)
        url = request.query.get('url', '')
        if not url or not manager.can_write_coll(user, coll):
            raise HTTPError(status=404, body='No Such Page')

        title = request.query.get('title', '')
        add_page = request.query.get('addpage', False)

        html_text = request.body.read()

        host = get_host()
        prefix = request.query.get('prefix', get_host())

        orig_html = HTMLDomUnRewriter.unrewrite_html(host, prefix, html_text)

        dt = datetime.utcnow()

        target = dict(output_dir=router.get_archive_dir(user, coll),
                      sesh_id=path.replace('/', ':'),
                      user_id=user,
                      json_metadata={'snapshot': 'html', 'timestamp': str(dt)},
                      writer_type='-snapshot')

        if url.startswith('https://'):
            url = url.replace('https:', 'http:')

        req_headers = {'warcprox-meta': json.dumps(target),
                       'content-type': 'text/html'}

        pagedata = {'url': url,
                    'title': title,
                    'tags': ['snapshot'],
                    'ts': datetime_to_timestamp(dt)
                   }

        try:
            resp = requests.request(method='PUTRES',
                                    url=url,
                                    data=orig_html,
                                    headers=req_headers,
                                    proxies=warcprox_proxies,
                                    verify=False)

            if add_page:
                manager.add_page(user, coll, pagedata)
        except:
            return {'status': 'err'}


        return {'status': resp.status_code}


    # Info
    # ============================================================================
    @route('/_info')
    def info():
        user, coll = r.get_user_coll(request.query['coll'])
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


    # Queue
    # ============================================================================
    @route('/_queue/:user/:coll')
    def get_queue(user, coll):
        return manager.get_from_queue(user, coll)


    @post('/_queue/:user/:coll')
    def rec_queue(user, coll):
        data = request.json
        res = manager.add_to_queue(user, coll, data)
        return res


    # WARC Files -- List
    # ============================================================================
    @route('/_files')
    def list_warcs():
        user = request.query.get('user', '')
        coll = request.query.get('coll', '')
        warcs = manager.list_warcs(user, coll)
        return {'data': warcs}


    # WARC Files -- Download
    # ============================================================================
    @route(['/:user/:coll/warcs/:warc'])
    @addcred()
    def download_warcs(user, coll, warc):
        res = manager.download_warc(user, coll, warc)
        if not res:
            raise HTTPError(status=404, body='No Such WARC')

        length, body = res
        response.headers['Content-Type'] = 'text/plain'
        response.headers['Content-Disposition'] = 'attachment; filename=' + warc
        response.headers['Content-Length'] = length
        response.body = body
        return response

        #resp = HTTPResponse(body=body,
        #                    status=resp.status_headers.statusline,
        #                    headers=resp.status_headers.headers)



    # pywb Replay / Patch / Record
    # ============================================================================
    @route([r.COLL + '/record/<:re:.*>'], method='ANY')
    @addcred(router=r)
    def record(info):
        if not manager.can_write_coll(info.user, info.coll):
            raise HTTPError(status=404, body='No Such Collection')

        if not manager.has_space(info.user):
            request.environ['webrec.no_space'] = True

        return call_pywb(info, 'record')

    @route([r.COLL + '/patch/<:re:.*>'], method='ANY')
    @addcred(router=r)
    def patch(info):
        if not manager.can_write_coll(info.user, info.coll):
            raise HTTPError(status=404, body='No Such Collection')

        if not manager.has_space(info.user):
            request.environ['webrec.no_space'] = True

        return call_pywb(info, 'patch')

    @route([r.COLL + '/live/<:re:.*>'], method='ANY')
    @addcred(router=r)
    def replay(info):
        if not manager.can_read_coll(info.user, info.coll):
            raise HTTPError(status=404, body='No Such Collection')

        return call_pywb(info, 'live')


    @route([r.COLL + '/record/', r.COLL + '/record',
            r.COLL + '/patch/', r.COLL + '/patch',
            r.COLL + '/live/', r.COLL + '/live'])
    @addcred(router=r)
    def redir_sub(info):
        redirect(info.coll)

    @route([r.COLL + '/<:re:.*>'], method='ANY')
    @addcred(router=r)
    def replay(info):
        if not manager.can_read_coll(info.user, info.coll):
            raise HTTPError(status=404, body='No Such Collection')

        return call_pywb(info, 'replay')


    @route([r.COLL + '/cdx'])
    @addcred(router=r)
    def cdx_dir(info):
        if not manager.can_read_coll(info.user, info.coll):
            raise HTTPError(status=404, body='No Such Collection')

        return call_pywb(info, 'cdx')


    @route(['/<:re:.*>'], method='ANY')
    @addcred()
    def fallthrough():
        return call_pywb()
