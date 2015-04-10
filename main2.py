from bottle import route, request, response, post, default_app
from bottle import redirect, run, HTTPError, HTTPResponse
from bottle import install

from bottle_utils.flash import message_plugin
from cork import Cork, AAAException

from Cookie import SimpleCookie

from pywb.framework.wsgi_wrappers import WSGIApp
from pywb.manager.manager import CollectionsManager

from redis import StrictRedis

from pywb.webapp.pywb_init import create_wb_router
from pywb.utils.loaders import load_yaml_config
from pywb.webapp.views import J2TemplateView

from pywb.manager.manager import main as manager_main

from pywb.warc.cdxindexer import iter_file_or_dir

from auth import init_cork

from loader import jinja_env, jinja2_view
import json

import os

import logging
logging.basicConfig(format='%(asctime)s: [%(levelname)s]: %(message)s',
                    level=logging.DEBUG)
logging.debug('')

install(message_plugin)

application = default_app()

redis_obj = StrictRedis.from_url('redis://127.0.0.1:6379/2')

application, cork = init_cork(application, redis_obj)

def init_pywb(configfile='config_man.yaml'):
    config = load_yaml_config(configfile)
    jinja_env.globals['metadata'] = config.get('metadata', {})
    return create_wb_router(config)

pywb_router = init_pywb()


def get_redir_back(skip, default='/'):
    redir_to = request.headers.get('Referer', default)
    if redir_to.endswith(skip):
        redir_to = default
    return redir_to

def call_pywb(env):
    resp = pywb_router(env)

    if not resp:
        raise HTTPError(status=404, body='No Response Found')

    resp = HTTPResponse(body=resp.body,
                        status=resp.status_headers.statusline,
                        headers=resp.status_headers.headers)

    # copy flash cookie
    if response._cookies:
        resp._cookies = SimpleCookie()
        resp._cookies.load(response._cookies.output(header=''))

    return resp

def post_get(name, default=''):
    return request.POST.get(name, default).strip()

def adduser(func):
    def func_wrapper(*args, **kwargs):
        if cork.user_is_anonymous:
            user = None
            role = None
        else:
            user = cork.current_user.username
            role = cork.current_user.role

        request.environ['w_temp_params'] = {'user': user,
                                            'role': role,
                                            'message': request.message}

        res = func(*args, **kwargs)
        if isinstance(res, dict):
            res['user'] = user
            res['role'] = role
            res['message'] = request.message

        return res

    return func_wrapper


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
    else:
        response.flash('Invalid Login. Please Try Again')
        redir_to = LOGIN_PATH

    redirect(redir_to)


@route(LOGOUT_PATH)
def logout():
    redir_to = get_redir_back(LOGOUT_PATH, '/')
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
        response.flash(msg)
        redirect('/')

    return {}

@post(CREATE_PATH)
def create_coll():
    cork.require(role='admin', fail_redirect=LOGIN_PATH)
    coll_name = post_get('collection')
    title = post_get('title', coll_name)
    access = post_get('public', 'private')

    title = 'title={0}'.format(title)
    access = 'access={0}'.format(access)

    success = False

    try:
        manager_main(['init', coll_name])
        manager_main(['metadata', coll_name, '--set', title, access])
        msg = 'Created Collection ' + coll_name
        success = True
    except ValueError as e:
        msg = str(e)

    except OSError as e:
        if e.errno == 17:
            msg = 'Collection ' + coll_name + ' already exists!'
        else:
            msg = str(e)

    except Exception as e:
        print(e)
        msg = 'Error creating collection.. Try Again'

    print(msg)
    response.flash(msg)

    if success:
        global pywb_router
        pywb_router = init_pywb()
        redirect('/')
    else:
        redirect(CREATE_PATH)



# ============================================================================
@route('/:coll/_files')
@jinja2_view('listwarcs.html')
def listwarcs(coll):
    cork.require(role='admin', fail_redirect=LOGIN_PATH)

    archive_dir = os.path.join('collections', coll, 'archive')

    warcs = []

    for fullpath, filename in iter_file_or_dir([archive_dir]):
        print(filename)
        warcs.append(filename)

    return {'warcs': warcs}

# Pages
# ============================================================================
@post(['/_addpage'])
def add_page():
    cork.require(role='archivist', fail_redirect=LOGIN_PATH)
    url = post_get('url')
    coll = post_get('coll')
    title = post_get('title')

    data = {'url': url}
    if title:
        data['title'] = title

    data = json.dumps(data)

    redis_obj.hincrby('pages:' + coll, data, 1)
    return {}

@route('/_listpages')
def list_pages():
    cork.require(role='archivist', fail_redirect=LOGIN_PATH)
    coll = request.query['coll']
    res = redis_obj.hgetall('pages:' + coll)
    pagelist = []
    for n, v in res.iteritems():
        entry = json.loads(n)
        entry['count'] = v
        pagelist.append(entry)

    return {"pages": pagelist}


# pywb Replay / Record
# ============================================================================
@route(['/static/<:re:.*>'])
def static():
    return call_pywb(request.environ)


@route(['/', '/index.html'])
@adduser
def home_pages():
    return call_pywb(request.environ)


@route(['/:coll', '/:coll/'])
@adduser
def coll_pages(coll):
    coll = coll.rstrip('/')
    if coll.endswith('-record'):
        redirect('/' + coll.split('-record', 1)[0])
        return

    return call_pywb(request.environ)


@route(['/:coll/record/<:re:.*>'])
@adduser
def record(coll, *args, **kwargs):
    cork.require(role='archivist', fail_redirect=LOGIN_PATH)
    return call_pywb(request.environ)


@route(['/:coll/<:re:.*>', '/<:re:.*>'])
@adduser
def replay(coll):
    cork.require(role='reader', fail_redirect=LOGIN_PATH)
    return call_pywb(request.environ)


if __name__ == "__main__":
    run(app=application, port=8088)
