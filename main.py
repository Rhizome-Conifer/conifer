from bottle import route, request, response, post, default_app
from bottle import redirect, run, HTTPError, HTTPResponse
from bottle import hook

from cork import Cork, AAAException

from Cookie import SimpleCookie

from pywb.framework.wsgi_wrappers import WSGIApp
from pywb.manager.manager import CollectionsManager

from redis import StrictRedis

from pywb.webapp.pywb_init import create_wb_router
from pywb.utils.loaders import load_yaml_config
from pywb.webapp.views import J2TemplateView
from pywb.utils.wbexception import WbException

from auth import init_cork, CollsManager

from loader import jinja_env, jinja2_view
import json

import os

import logging
logging.basicConfig(format='%(asctime)s: [%(levelname)s]: %(message)s',
                    level=logging.DEBUG)
logging.debug('')

#install(message_plugin)

application = default_app()

redis_obj = StrictRedis.from_url('redis://127.0.0.1:6379/1')

bottle_app = application
application, cork = init_cork(application, redis_obj)

manager = CollsManager(cork, redis_obj)


def init_pywb(configfile='config.yaml'):
    config = load_yaml_config(configfile)
    jinja_env.globals['metadata'] = config.get('metadata', {})
    pywb_router = create_wb_router(config)
    return pywb_router


pywb_router = init_pywb()

#@hook('after_request')
#def enable_cors():
#    response.headers['Access-Control-Allow-Origin'] = '*'

def get_redir_back(skip, default='/'):
    redir_to = request.headers.get('Referer', default)
    if redir_to.endswith(skip):
        redir_to = default
    return redir_to


def call_pywb(coll=None, state=None, shift=1):

    if coll:
        request.path_shift(shift)
        request.environ['w_output_dir'] = './collections/{0}/archive'.format(coll)
        request.environ['w_sesh_id'] = coll
        request.environ['pywb.template_params']['state'] = state

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

def post_get(name, default=''):
    return request.POST.get(name, default).strip()

def adduser(func):
    def func_wrapper(*args, **kwargs):
        sesh = request.environ.get('beaker.session')
        user = None
        role = None

        try:
            if not cork.user_is_anonymous:
                user = cork.current_user.username
                role = cork.current_user.role
        except Exception as e:
            print('SESH INVALID')
            if sesh:
                sesh.invalidate()

        message = ''
        if sesh:
            message = sesh.get('message', '')
            if message:
                sesh['message'] = ''
                sesh.save()

        request.environ['pywb.template_params'] = {'user': user,
                                            'role': role,
                                            'message': message}

        res = func(*args, **kwargs)
        if isinstance(res, dict):
            res['user'] = user
            res['role'] = role
            res['message'] = message

        return res

    return func_wrapper


def flash_message(msg):
    sesh = request.environ.get('beaker.session')
    if sesh:
        sesh['message'] = msg
        sesh.save()
    else:
        print('No Message')


# ============================================================================
@jinja2_view('error.html')
@adduser
def err_handle(out):
    return {'err': out}

bottle_app.default_error_handler = err_handle


# ============================================================================
LOGIN_PATH = '/_login'
LOGOUT_PATH = '/_logout'
CREATE_PATH = '/_create'


# Login/Logout
# ============================================================================
@route(LOGIN_PATH)
@jinja2_view('login.html')
@adduser
def login():
    return {}


@post(LOGIN_PATH)
def login_post():
    """Authenticate users"""
    username = post_get('username')
    password = post_get('password')

    if cork.login(username, password):
        redir_to = get_redir_back(LOGIN_PATH, '/')
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
@adduser
def create_coll_static():
    try:
        cork.require(role='admin')
    except AAAException:
        msg = "Sorry, You don't have enough permission to create a new collection"
        flash_message(msg)
        redirect('/')

    return {}


@post(CREATE_PATH)
def create_coll():
    cork.require(role='admin', fail_redirect=LOGIN_PATH)
    coll_name = post_get('collection')
    title = post_get('title', coll_name)
    access = post_get('public', 'private')

    success, msg = manager.add_collection(coll_name, title, access)
    flash_message(msg)

    if success:
        #pywb_router = init_pywb()
        redirect('/')
    else:
        redirect(CREATE_PATH)

# WARC Files
# ============================================================================
@route('/:coll/_files')
@jinja2_view('listwarcs.html')
def listwarcs(coll):
    cork.require(role='admin', fail_redirect=LOGIN_PATH)

    warcs = manager.list_warcs(coll)

    return {'warcs': warcs}


# Pages
# ============================================================================
@post(['/_addpage'])
def add_page():
    cork.require(role='archivist', fail_redirect=LOGIN_PATH)
    coll = request.query['coll']

    data = {}

    for item in request.forms:
        data[item] = request.forms.get(item)

    manager.add_page(coll, data)
    return {}

@route('/_listpages')
def list_pages():
    coll = request.query['coll']
    if not manager.can_read_coll(coll):
        return {}

    pagelist = redis_obj.smembers('pages:' + coll)
    pagelist = map(json.loads, pagelist)
    return {"data": pagelist}


# pywb static and home
# ============================================================================
@route(['/static/<:re:.*>'])
def static():
    return call_pywb()


@route(['/', '/index.html'])
@jinja2_view('index.html')
@adduser
def home_pages():
    return {'colls': manager.list_collections()}


# ============================================================================
# Banner
@route('/banner')
@jinja2_view('banner_page.html')
@adduser
def banner():
    return {'coll': request.query.get('coll'),
            'banner': request.query.get('state')}

# ============================================================================
# Collection View
@route(['/:coll/record', '/:coll/record/'])
def record_redir(coll):
    redirect('/' + coll)


@route(['/:coll', '/:coll/'])
@jinja2_view('search.html')
@adduser
def coll_page(coll):
    coll_obj = manager.collections[coll]
    if not manager.can_read_coll(coll_obj):
        raise HTTPError(status=404, body='No Such Collection')

    return {'coll': coll,
            'title': coll_obj.get('title')}


# pywb Replay / Record
# ============================================================================
@route(['/:coll/record/<:re:.*>'], method='ANY')
@adduser
def record(coll, *args, **kwargs):
    if not manager.can_record_coll(coll):
        raise HTTPError(status=404, body='No Such Collection')

    return call_pywb(coll, 'rec')


@route(['/:coll/<:re:.*>'], method='ANY')
@adduser
def replay(coll):
    if not manager.can_read_coll(coll):
        raise HTTPError(status=404, body='No Such Collection')

    return call_pywb(coll, 'play')


@route(['/:coll/cdx'])
def cdx_dir(coll):
    request.path_shift(1)
    request.environ['w_output_dir'] = './collections/{0}/archive'.format(coll)
    request.environ['w_sesh_id'] = coll

    return call_pywb(coll, 'cdx')

@route(['/<:re:.*>'], method='ANY')
@adduser
def fallthrough():
    return call_pywb()


# ============================================================================
if __name__ == "__main__":
    run(app=application, port=8088)
