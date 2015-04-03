import bottle
import loader
from redis import StrictRedis

from pywb.webapp.pywb_init import create_wb_router
from pywb.utils.loaders import load_yaml_config

from auth import UserCollsManager, init_cork

import logging
logging.basicConfig(format='%(asctime)s: [%(levelname)s]: %(message)s',
                    level=logging.DEBUG)
logging.debug('')

application = bottle.default_app()

redis_obj = StrictRedis()

application, cork = init_cork(application, redis_obj)

manager = UserCollsManager(cork, redis_obj)


def init_pywb(configfile='config.yaml'):
    config = load_yaml_config(configfile)
    pywb_router = create_wb_router(config)
    return pywb_router

pywb_router = init_pywb()


def call_pywb(env):
    resp = pywb_router(env)

    if not resp:
        return None

    resp = bottle.HTTPResponse(body=resp.body,
                               status=resp.status_headers.statusline,
                               headers=resp.status_headers.headers)
    return resp

def post_get(name, default=''):
    return bottle.request.POST.get(name, default).strip()


@bottle.route("/")
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
@bottle.route('/login')
@bottle.jinja2_view('login.html', template_lookup=['templates'])
def login():
    return {}

@bottle.post('/login')
def login_post():
    """Authenticate users"""
    username = post_get('username')
    password = post_get('password')
    cork.login(username, password, success_redirect='/', fail_redirect='/login')

@bottle.route('/logout')
def logout():
    cork.logout(success_redirect='/')


# User Page
# ============================================================================
@bottle.route('/:user/')
@bottle.route('/:user')
@bottle.jinja2_view('user.html', template_lookup=['templates'])
def user_page(user):
    if not manager.exists(user):
        raise bottle.HTTPError(status=404, body='No such archive: ' + user)

    return {'user': user,
            'colls': manager.list_colls(user),
            'is_owner': manager.is_user(user)
           }

# Create Coll
# ============================================================================
@bottle.route('/:user/_create')
@bottle.jinja2_view('create.html', template_lookup=['templates'])
def create_coll_static(user):
    cork.require(username=user, fail_redirect='/login')
    return {'user': user}


@bottle.post('/:user/_create')
def create_coll(user):
    cork.require(username=user, fail_redirect='/login')
    coll_name = post_get('collection')

    res = manager.add_collection(user, coll_name)
    bottle.redirect('/' + user)


# pywb Replay / Record
# ============================================================================
@bottle.route(['/:user/:coll/record/<:re:.*>'])
def record(user, coll, *args, **kwargs):
    cork.require(username=user, fail_redirect='/login')
    resp = call_pywb(bottle.request.environ)
    if not resp:
        raise bottle.HTTPError(status=404)

    return resp

@bottle.route(['/static/', '/:user/:coll/<:re:.*>'])
def main(*args, **kwargs):
    resp = call_pywb(bottle.request.environ)
    if not resp:
        raise bottle.HTTPError(status=404)

    return resp



if __name__ == "__main__":
    bottle.run(app=application)
