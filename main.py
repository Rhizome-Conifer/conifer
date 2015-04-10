from bottle import route, request, response, post, jinja2_view, default_app
from bottle import redirect, run, HTTPError, HTTPResponse
from bottle import install
from bottle_utils.flash import message_plugin

from pywb.framework.wsgi_wrappers import WSGIApp

import functools
from redis import StrictRedis

from pywb.webapp.pywb_init import create_wb_router
from pywb.utils.loaders import load_yaml_config

from auth import UserCollsManager, init_cork
from loader import jinja2_view

import logging
logging.basicConfig(format='%(asctime)s: [%(levelname)s]: %(message)s',
                    level=logging.DEBUG)
logging.debug('')

install(message_plugin)

application = default_app()

redis_obj = StrictRedis.from_url('redis://127.0.0.1:6379/2')

application, cork = init_cork(application, redis_obj)

#application = WSGIApp(pywb_router, application)

manager = UserCollsManager(cork, redis_obj)

def init_pywb(configfile='config.yaml'):
    config = load_yaml_config(configfile)
    config['user_manager'] = manager
    return create_wb_router(config)
    #return create_wb_router(config)

pywb_router = init_pywb()


def call_pywb(env):
    resp = pywb_router(env)

    if not resp:
        raise HTTPError(status=404, body='No Response Found')

    resp = HTTPResponse(body=resp.body,
                        status=resp.status_headers.statusline,
                        headers=resp.status_headers.headers)
    return resp

def post_get(name, default=''):
    return request.POST.get(name, default).strip()


@route("/")
def index():
    if cork.user_is_anonymous:
        user = 'not_logged_in'
        userlist = []
    else:
        user = cork.current_user.username
        userlist = cork.list_users()

    return 'WARCs for All: ' + user

# Login/Logout
# ============================================================================
@route('/login')
@jinja2_view('templates/login.html')
def login():
    return {}

@post('/login')
def login_post():
    """Authenticate users"""
    username = post_get('username')
    password = post_get('password')
    cork.login(username, password, success_redirect='/', fail_redirect='/login')


@route('/logout')
def logout():
    cork.logout(success_redirect='/')


# User Page
# ============================================================================
@route('/:user/')
@route('/:user')
@jinja2_view('templates/user.html')
def user_page(user):
    if not manager.user_exists(user):
        raise HTTPError(status=404, body='No such archive: ' + user)

    return {'user': user,
            'colls': manager.list_colls(user),
            'is_owner': manager.is_user(user),
            'message': request.message,
           }

# Create Coll
# ============================================================================
@route('/:user/_create')
@jinja2_view('templates/create.html')
def create_coll_static(user):
    cork.require(username=user, fail_redirect='/login')
    return {'user': user,
            'message': request.message}


@post('/:user/_create')
def create_coll(user):
    cork.require(username=user, fail_redirect='/login')
    coll_name = post_get('collection')
    access = post_get('public')

    success, msg = manager.add_collection(user, coll_name, access)
    response.flash(msg)

    if success:
    #    global pywb_router
    #    pywb_router = init_pywb()
        redirect('/' + user)
    else:
        redirect('/' + user + '/_create')


# pywb Replay / Record
# ============================================================================
@route(['/live/<:re:.*>', '/static/<:re:.*>'])
def static():
    return call_pywb(request.environ)


@route(['/:user/:coll/record/<:re:.*>'])
def record(user, coll, *args, **kwargs):
    request.path_shift(2)
    request.environ['w_output_dir'] = './users/{0}/collections/{1}'.format(user, coll)
    request.environ['w_sesh_id'] = user + ':' + coll

    cork.require(username=user, fail_redirect='/login')
    return call_pywb(request.environ)


@route(['/:user/:coll/<:re:.*>', '/:user/:coll-cdx<:re:.*>'])
def replay(user, coll):
    if not manager.can_user_read(user, coll):
        raise HTTPError(status=404)

    request.path_shift(2)
    request.environ['w_output_dir'] = './users/{0}/collections/{1}'.format(user, coll)
    request.environ['w_sesh_id'] = user + ':' + coll


    jinja_env.globals['user'] = user
    return call_pywb(request.environ)


@route(['/<:re:.*>'])
def fallthrough():
    return call_pywb(request.environ)


if __name__ == "__main__":
    run(app=application)
