from bottle import Bottle, debug, request, response

import logging
import json
import redis

from os.path import expandvars
import os
import yaml

from beaker.middleware import SessionMiddleware

from jinja2 import contextfunction
from urlrewrite.templateview import JinjaEnv

from six.moves.urllib.parse import urlsplit, urljoin

from webrecorder.contentcontroller import ContentController
from webrecorder.recscontroller import RecsController
from webrecorder.collscontroller import CollsController
from webrecorder.logincontroller import LoginController
from webrecorder.infocontroller import InfoController
from webrecorder.browsercontroller import BrowserController

from webrecorder.webreccork import WebRecCork

from webrecorder.cookieguard import CookieGuard

from webrecorder.redisman import RedisDataManager
from webrecorder.session import Session

from webrecorder.basecontroller import BaseController


# ============================================================================
class AppController(BaseController):
    def __init__(self, configfile='config.yaml', redis_url=None):
        self._init_logging()

        bottle_app = Bottle()
        self.bottle_app = bottle_app

        # Load config
        with open(configfile, 'rb') as fh:
            config = yaml.load(fh)

        # Init Redis
        if not redis_url:
            redis_url = expandvars(config['redis_url'])

        self.redis = redis.StrictRedis.from_url(redis_url)
        self.browser_redis = redis.StrictRedis.from_url(os.environ['REDIS_BROWSER_URL'])

        # Init Cork
        self.cork = WebRecCork.create_cork(self.redis, config)

        # Init Manager
        manager = RedisDataManager(self.redis, self.cork, self.browser_redis, config)

        # Init Jinja
        jinja_env = JinjaEnv(globals={'static_path': 'static/__pywb'})

        # Init Core app controllers
        rewrite_controller = ContentController(bottle_app, jinja_env, manager, config)
        browser_controller = BrowserController(bottle_app, jinja_env, manager, config=config)
        login_controller = LoginController(bottle_app, jinja_env, manager, config=config)
        info_controller = InfoController(bottle_app, jinja_env, manager, config)
        recs_controller = RecsController(bottle_app, jinja_env, manager, config)
        colls_controller = CollsController(bottle_app, jinja_env, manager, config)

        bottle_app.install(AddSession(self.cork, config))

        # Set Error Handler
        bottle_app.default_error_handler = self.make_err_handler(
                                            bottle_app.default_error_handler)

        #webrec = WebRecUserManager(bottle_app, config, cork, redis_obj, jinja_env)
        #init_routes(webrec)

        # Init Middleware apps
        session_opts = self._get_session_opts(config)
        final_app = bottle_app
        final_app = CookieGuard(final_app, session_opts['session.key'])
        final_app = SessionMiddleware(final_app, session_opts)

        #invites = expandvars(config.get('invites_enabled', 'true')).lower()
        #self.invites_enabled = invites in ('true', '1', 'yes')

        self.init_jinja_env(config, jinja_env.jinja_env)

        super(AppController, self).__init__(final_app, jinja_env, manager, config)

    def init_jinja_env(self, config, jinja_env):
        jinja_env.globals['metadata'] = config.get('metadata', {})

        @contextfunction
        def can_admin(context):
            return self.manager.can_admin_coll(context.get('user', ''), context.get('coll', ''))

        @contextfunction
        def is_owner(context):
            return self.manager.is_owner(context.get('user', ''))

        @contextfunction
        def can_write(context):
            return self.manager.can_write_coll(context.get('user', ''), context.get('coll', ''))

        @contextfunction
        def can_read(context):
            return self.manager.can_read_coll(context.get('user', ''), context.get('coll', ''))

        @contextfunction
        def is_anon(context):
            return self.manager.is_anon(context.get('user'))

        @contextfunction
        def get_path(context, user, coll, rec):
            if self.manager.is_anon(user):
                base = '/anonymous'
            else:
                base = '/' + user + '/' + coll

            if rec:
                base += '/' + rec

            return base

        jinja_env.globals['can_admin'] = can_admin
        jinja_env.globals['can_write'] = can_write
        jinja_env.globals['can_read'] = can_read
        jinja_env.globals['is_owner'] = is_owner
        jinja_env.globals['is_anon'] = is_anon
        jinja_env.globals['get_path'] = get_path

    def init_routes(self):
        @self.bottle_app.route(['/', '/index.html'])
        @self.jinja2_view('index.html')
        def home_page():
            resp = {'curr_mode': 'new'}
            return resp

    def make_err_handler(self, default_err_handler):
        @self.jinja2_view('error.html')
        def error_view(out):
            return {'err': out}

        def json_error(body_dict):
            response.content_type = 'application/json'
            res = json.dumps(body_dict)
            print(res)
            return res

        def err_handler(out):
            if (isinstance(out.exception, dict) and
                hasattr(out, 'json_err')):
                return json_error(out.exception)
            else:
                if out.status_code == 404:
                    if self._check_refer_redirect():
                        return

                if out.status_code == 500:
                    print(out.traceback)

                return error_view(out)
                #return default_err_handler(out)

        return err_handler

    def _check_refer_redirect(self):
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

    def _init_logging(self):
        # bottle debug
        debug(True)

        # Logging
        logging.basicConfig(format='%(asctime)s: [%(levelname)s]: %(message)s',
                            level=logging.DEBUG)
        logging.debug('')

        # set boto log to error
        boto_log = logging.getLogger('boto')
        if boto_log:
            boto_log.setLevel(logging.ERROR)

    def _get_session_opts(self, config):
        session_opts = config.get('session_opts')

        for n, v in session_opts.items():
            if isinstance(v, str):
                session_opts[n] = expandvars(v)

        # url for redis
        url = session_opts.get('session.url')
        if url:
            parts = urlsplit(url)
            if parts.netloc:
                session_opts['session.url'] = parts.netloc
            #session_opts['session.db'] = 0

        return session_opts


# =============================================================================
class AddSession(object):
    def __init__(self, cork, config):
        self.cork = cork
        self.anon_duration = config.get('anon_duration', True)

    def __call__(self, func):
        def func_wrapper(*args, **kwargs):
            request.environ['webrec.session'] = Session(self.cork, self.anon_duration)
            return func(*args, **kwargs)

        return func_wrapper


