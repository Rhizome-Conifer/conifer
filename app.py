from bottle import route, request, response, post, default_app
from bottle import redirect, run, HTTPError, HTTPResponse
from bottle import hook

from cork import Cork, AAAException

from pywb.framework.wsgi_wrappers import WSGIApp
from pywb.manager.manager import CollectionsManager

from redis import StrictRedis

from pywb.webapp.pywb_init import create_wb_router
from pywb.utils.loaders import load_yaml_config
from pywb.webapp.views import J2TemplateView
from pywb.utils.wbexception import WbException

from auth import init_cork, CollsManager

from loader import jinja_env, jinja2_view, DynRedisResolver
from jinja2 import contextfunction

import json

import os

import logging


# ============================================================================
# App Init
application = None
cork = None
manager = None
redis_obj = None
pywb_router = None

root_dir = './'

from collections import namedtuple

RouteInfo = namedtuple('RouteInfo', 'path, user, coll, shift, store_path')

class MultiUserRouter(object):
    COLL = '/:user/:coll'
    USER = '/:user'

    @staticmethod
    def get_user_account_root(user):
        return os.path.join(root_dir, 'accounts', user)

    @staticmethod
    def get_archive_dir(user, coll):
        return os.path.join(root_dir, 'accounts', user, 'collections', coll, 'archive')

    @staticmethod
    def user_home(user):
        return '/' + user

    @staticmethod
    def get_user_coll(collpath):
        user, coll = collpath.split('/', 1)
        return user, coll

    @staticmethod
    def get_state(kwargs):
        user = kwargs.get('user', '')
        coll = kwargs.get('coll', '')

        info = RouteInfo(user + '/' + coll,
                         user,
                         coll,
                         2, root_dir + 'accounts/{0}/collections/{1}/archive'.format(user, coll))

        return info


class SingleUserRouter(object):
    COLL = '/:coll'
    USER = '/'

    @staticmethod
    def user_home(user):
        return '/'

    @staticmethod
    def get_user_coll(collpath):
        return 'default', collpath

    @staticmethod
    def get_state(kwargs):
        coll = kwargs.get('coll', '')

        info = RouteInfo(coll,
                        'default',
                         coll,
                         1, root_dir + 'collections/{0}/archive'.format(coll))

        return info



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

    global root_dir
    root_dir = store_root

    global multiuser
    multiuser = config.get('multiuser', False)
    if multiuser:
        router = MultiUserRouter()
    else:
        router = SingleUserRouter()

    global redis_obj
    if not redis_url:
        redis_url = config['redis_url']

    redis_obj = StrictRedis.from_url(redis_url)

    global application
    global cork
    application, cork = init_cork(bottle_app, redis_obj)

    global manager
    manager = CollsManager(cork, redis_obj, router)

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


    config['redis_warc_resolver'] = DynRedisResolver(redis_obj)

    global pywb_router
    pywb_router = create_wb_router(config)

    @jinja2_view('error.html')
    @addcred()
    def err_handle(out):
        return {'err': out}

    bottle_app.default_error_handler = err_handle
    create_coll_routes(router)
    return application


# ============================================================================
# Utilities
def get_redir_back(skip, default='/'):
    redir_to = request.headers.get('Referer', default)
    if redir_to.endswith(skip):
        redir_to = default
    return redir_to


def post_get(name, default=''):
    return request.POST.get(name, default).strip()


def flash_message(msg):
    sesh = request.environ.get('beaker.session')
    if sesh:
        sesh['message'] = msg
        sesh.save()
    else:
        print('No Message')


def call_pywb(info=None, state=None):
    if info:
        request.path_shift(info.shift)
        request.environ['w_output_dir'] = info.store_path
        request.environ['w_sesh_id'] = info.path
        request.environ['pywb.template_params']['state'] = state
        request.environ['pywb.template_params']['coll'] = info.path

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
                    sesh.invalidate()

            message = ''
            if sesh:
                message = sesh.get('message', '')
                if message:
                    sesh['message'] = ''
                    sesh.save()

            params = {'curr_user': curr_user,
                      'curr_role': curr_role,
                      'message': message}

            request.environ['pywb.template_params'] = params

            if self.router:
                res = func(self.router.get_state(kwargs))
            else:
                res = func(*args, **kwargs)

            if isinstance(res, dict):
                res['curr_user'] = curr_user
                res['curr_role'] = curr_role
                res['message'] = message

            return res

        return func_wrapper


# ============================================================================
LOGIN_PATH = '/_login'
LOGOUT_PATH = '/_logout'
CREATE_PATH = '/_create'


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
            #sesh = request.environ.get('beaker.session')
            #header = request.headers.get('Host')
            #if header:
                #header = header.split(':')[0]
                #sesh.domain = '.' + header
        else:
            flash_message('Invalid Login. Please Try Again')
            redir_to = LOGIN_PATH

        redirect(redir_to)


    @route(LOGOUT_PATH)
    def logout():
        #redir_to = get_redir_back(LOGOUT_PATH, '/')
        redir_to = '/'
        cork.logout(success_redirect=redir_to, fail_redirect=redir_to)


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

        return {}


    @post(CREATE_PATH)
    def create_coll():
        cork.require(role='archivist', fail_redirect=LOGIN_PATH)
        coll_name = post_get('collection')
        title = post_get('title', coll_name)
        access = post_get('public', 'private')

        user, role = manager.curr_user_role()

        success, msg = manager.add_collection(user, coll_name, title, access)
        flash_message(msg)

        if success:
            redirect(r.user_home(manager.curr_user_role()[0]))
        else:
            redirect(CREATE_PATH)

    # WARC Files
    # ============================================================================
    @route('/_files')
    def listwarcs():
        user = request.query.get('user', '')
        coll = request.query.get('coll', '')
        warcs = manager.list_warcs(user, coll)
        return {'warcs': warcs}


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
    if multiuser:
        @route(['/', '/index.html'])
        @jinja2_view('index.html')
        @addcred()
        def shared_home_page():
            return {}

    # User Page
    @route([r.USER, r.USER + '/', r.USER + '/index.html'])
    @jinja2_view('user.html')
    @addcred()
    def home_pages(user=None):
        if user:
            if not manager.has_user(user):
                raise HTTPError(status=404, body='No Such Archive')

            path = user
        else:
            user = 'default'
            path = '/'

        return {'path': path,
                'user': user,
                'colls': manager.list_collections(user)}


    # ============================================================================
    # Collection View
    @route([r.COLL, r.COLL + '/'])
    @jinja2_view('search.html')
    @addcred(router=r)
    def coll_page(info):
        if not manager.can_read_coll(info.user, info.coll):
            raise HTTPError(status=404, body='No Such Collection')

        return {'user': info.user,
                'coll': info.coll,
                'path': info.path,

                'is_public': manager.is_public(info.user, info.coll),

                'title': manager.get_metadata(info.user, info.coll, 'title')
               }

    @route([r.COLL + '/record', r.COLL + '/record/'])
    @addcred(router=r)
    def record_redir(info):
        redirect('/' + info.path)

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


    # pywb Replay / Record
    # ============================================================================
    @route([r.COLL + '/record/<:re:.*>'], method='ANY')
    @addcred(router=r)
    def record(info):
        if not manager.can_write_coll(info.user, info.coll):
            raise HTTPError(status=404, body='No Such Collection')

        return call_pywb(info, 'rec')


    @route([r.COLL + '/<:re:.*>'], method='ANY')
    @addcred(router=r)
    def replay(info):
        if not manager.can_read_coll(info.user, info.coll):
            raise HTTPError(status=404, body='No Such Collection')

        return call_pywb(info, 'play')


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
