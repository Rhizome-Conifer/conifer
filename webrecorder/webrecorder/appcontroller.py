from bottle import Bottle, debug, JSONPlugin, request, response

import logging
import json
import redis
import re

import os

from jinja2 import contextfunction
from urlrewrite.templateview import JinjaEnv

from six.moves.urllib.parse import urlsplit, urljoin

from webagg.utils import load_config

from webrecorder.apiutils import CustomJSONEncoder
from webrecorder.contentcontroller import ContentController
from webrecorder.snapshotcontroller import SnapshotController
from webrecorder.websockcontroller import WebsockController
from webrecorder.recscontroller import RecsController
from webrecorder.collscontroller import CollsController
from webrecorder.logincontroller import LoginController
from webrecorder.usercontroller import UserController
from webrecorder.downloadcontroller import DownloadController
from webrecorder.uploadcontroller import UploadController

from webrecorder.browsermanager import BrowserManager

from webrecorder.webreccork import WebRecCork

from webrecorder.cookieguard import CookieGuard

from webrecorder.redisman import RedisDataManager
from webrecorder.session import Session, RedisSessionMiddleware

from webrecorder.basecontroller import BaseController


# ============================================================================
class AppController(BaseController):
    ALL_CONTROLLERS = [DownloadController,
                       UploadController,
                       LoginController,
                       UserController,
                       #ContentController,
                       SnapshotController,
                       WebsockController,
                       RecsController,
                       CollsController
                      ]


    def __init__(self, configfile=None, overlay_config=None, redis_url=None):
        self._init_logging()

        bottle_app = Bottle()
        self.bottle_app = bottle_app

        # JSON encoding for datetime objects
        self.bottle_app.install(JSONPlugin(json_dumps=lambda s: json.dumps(s, cls=CustomJSONEncoder)))

        config = load_config('WR_CONFIG', configfile, 'WR_USER_CONFIG', overlay_config)

        # Init Redis
        if not redis_url:
            redis_url = os.environ['REDIS_BASE_URL']

        self.redis = redis.StrictRedis.from_url(redis_url)
        self.browser_redis = redis.StrictRedis.from_url(os.environ['REDIS_BROWSER_URL'], decode_responses=True)
        self.session_redis = redis.StrictRedis.from_url(os.environ['REDIS_SESSION_URL'])

        # Init Jinja
        jinja_env = self.init_jinja_env(config)

        # Init Content Loader/Rewriter
        content_app = ContentController(app=bottle_app,
                                        jinja_env=jinja_env,
                                        config=config,
                                        redis=self.redis)

        # Init Browser Mgr
        self.browser_mgr = BrowserManager(config, self.browser_redis, content_app)

        # Init Cork
        self.cork = WebRecCork.create_cork(self.redis, config)

        # Init Manager
        manager = RedisDataManager(self.redis, self.cork, content_app,
                                   self.browser_redis, self.browser_mgr, config)

        # Init Sesion temp_prefix
        Session.temp_prefix = config['temp_prefix']

        # Init Core app controllers
        for controller_type in self.ALL_CONTROLLERS:
            x = controller_type(app=bottle_app,
                                jinja_env=jinja_env,
                                manager=manager,
                                config=config)

        # Set Error Handler
        bottle_app.default_error_handler = self.make_err_handler(
                                            bottle_app.default_error_handler)

        final_app = RedisSessionMiddleware(bottle_app,
                                           self.cork,
                                           self.session_redis,
                                           config)

        super(AppController, self).__init__(final_app, jinja_env, manager, config)

    def init_jinja_env(self, config):
        jinja_env_wrapper = JinjaEnv(assets_path=config['assets_path'])

        jinja_env = jinja_env_wrapper.jinja_env

        jinja_env.globals['metadata'] = config.get('metadata', {})

        def get_coll(context):
            coll = context.get('coll_orig', '')
            if not coll:
                coll = context.get('coll', '')
            return coll

        def get_user(context):
            return context.get('user', '')

        def get_browsers():
            return self.browser_mgr.get_browsers()

        def get_tags():
            return self.manager.get_available_tags()

        def get_tags_in_collection(user, coll):
            return self.manager.get_tags_in_collection(user, coll)

        @contextfunction
        def can_admin(context):
            return self.manager.can_admin_coll(get_user(context), get_coll(context))

        @contextfunction
        def is_owner(context):
            return self.manager.is_owner(get_user(context))

        @contextfunction
        def can_write(context):
            res = self.manager.can_write_coll(get_user(context), get_coll(context))
            return res

        @contextfunction
        def can_read(context):
            return self.manager.can_read_coll(get_user(context), get_coll(context))

        @contextfunction
        def is_anon(context):
            return self.manager.is_anon(get_user(context))

        @contextfunction
        def get_path(context, user, coll=None, rec=None):
            return self.get_path(user, coll, rec)

        @contextfunction
        def get_body_class(context, action):
            return self.get_body_class(context, action)

        @contextfunction
        def is_out_of_space(context):
            return self.manager.is_out_of_space(context.get('curr_user', ''))

        @contextfunction
        def is_tagged(context, bookmark_id):
            available = context.get('available_tags', [])
            tags = context.get('tags', [])

            for tag in available:
                if tag in tags and bookmark_id in tags[tag]:
                    return True
            return False

        def trunc_url(value):
            """ Truncate querystrings, appending an ellipses
            """
            return re.sub(r'(\?.*)', '?...', value)

        jinja_env.globals['can_admin'] = can_admin
        jinja_env.globals['can_write'] = can_write
        jinja_env.globals['can_read'] = can_read
        jinja_env.globals['is_owner'] = is_owner
        jinja_env.globals['is_anon'] = is_anon
        jinja_env.globals['get_path'] = get_path
        jinja_env.globals['get_body_class'] = get_body_class
        jinja_env.globals['is_out_of_space'] = is_out_of_space
        jinja_env.globals['get_browsers'] = get_browsers
        jinja_env.globals['get_tags'] = get_tags
        jinja_env.globals['is_tagged'] = is_tagged
        jinja_env.globals['get_tags_in_collection'] = get_tags_in_collection
        jinja_env.filters['trunc_url'] = trunc_url

        return jinja_env_wrapper

    def init_routes(self):
        @self.bottle_app.route(['//<url:re:.*>'])
        def empty(url=''):
            self.redirect('/' + url)

        @self.bottle_app.route(['/<user>//<url:re:.*>'])
        def empty2(user, url=''):
            self.redirect('/' + user + '/' + url)

        @self.bottle_app.route(['/', '/index.html'])
        @self.jinja2_view('index.html', refresh_cookie=False)
        def home_page():
            self.redir_host()
            resp = {'is_home': '1'}

            curr_user = self.manager.get_curr_user()

            if curr_user:
                coll_list = self.manager.get_collections(curr_user)

                resp['collections'] = coll_list
                resp['num_collections'] = len(coll_list)
                resp['coll_title'] = ''
                resp['rec_title'] = ''

            else:
                self.fill_anon_info(resp)

            return resp

        @self.bottle_app.route('/_message')
        def flash_message():
            message = request.query.getunicode('message', '')
            msg_type = request.query.getunicode('msg_type', '')
            print(message, msg_type)
            self.flash_message(message, msg_type)
            return {}

        @self.bottle_app.route('/_policies')
        @self.jinja2_view('policies.html')
        def policies():
            return {}

        @self.bottle_app.route('/<:re:.*>', method='ANY')
        def fallthrough():
            self._check_refer_redirect()

    def make_err_handler(self, default_err_handler):
        @self.jinja2_view('error.html', refresh_cookie=False)
        def error_view(out, **params):
            params['err'] = out
            return params

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
                    start_path = request.environ.get('SCRIPT_NAME')
                    if not start_path:
                        start_path = request.environ.get('PATH_INFO')
                    #else:
                    #    url = request.environ.get('PATH_INFO', '')[1:]

                    if start_path.startswith('/' + self.manager.temp_prefix):
                        res = error_view(out, is_temp=True)
                        return res

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
        response.status = 307
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


