from bottle import debug, request, response, redirect, BaseRequest, static_file

import logging
import json
import redis
import re

import sys
import os


from jinja2 import contextfunction
from pkg_resources import resource_filename

from six.moves.urllib.parse import urlsplit, urljoin, unquote, urlencode

from pywb.rewrite.templateview import JinjaEnv
from webrecorder.utils import load_wr_config, init_logging, spawn_once

from webrecorder.apiutils import APIBottle, wr_api_spec
from webrecorder.admincontroller import AdminController
from webrecorder.contentcontroller import ContentController
from webrecorder.snapshotcontroller import SnapshotController
from webrecorder.websockcontroller import WebsockController
from webrecorder.recscontroller import RecsController
from webrecorder.collscontroller import CollsController
from webrecorder.listscontroller import ListsController
#from webrecorder.logincontroller import LoginController
from webrecorder.bugreportcontroller import BugReportController
from webrecorder.usercontroller import UserController
from webrecorder.downloadcontroller import DownloadController
from webrecorder.uploadcontroller import UploadController
from webrecorder.appcontroller import AppController
from webrecorder.autocontroller import AutoController
from webrecorder.behaviormgr import BehaviorMgr

from webrecorder.browsermanager import BrowserManager

from webrecorder.webreccork import WebRecCork

from webrecorder.session import Session, RedisSessionMiddleware

from webrecorder.models.access import SessionAccessCache
from webrecorder.models.usermanager import UserManager
from webrecorder.models.datshare import DatShare

from webrecorder.rec.storage import storagepaths

from webrecorder.basecontroller import BaseController

from wsgiprox.wsgiprox import WSGIProxMiddleware

from webrecorder.standalone.assetsutils import default_build


# ============================================================================
class MainController(BaseController):
    ALL_CONTROLLERS = [DownloadController,
                       UploadController,
                       AppController,
                       #LoginController,
                       UserController,
                       AdminController,
                       BugReportController,
                       SnapshotController,
                       WebsockController,
                       RecsController,
                       CollsController,
                       ListsController,
                       AutoController,
                       BehaviorMgr,
                      ]


    def __init__(self, redis_url=None):
        self._init_logging()

        if getattr(sys, 'frozen', False):
            self.static_root = os.path.join(sys._MEIPASS, 'webrecorder', 'static/')
        else:
            self.static_root = resource_filename('webrecorder', 'static/')

            # only launch if running in place, not from installed package
            if '.egg' not in __file__:
                spawn_once(default_build, worker=1, force_build=False)

        BaseRequest.MEMFILE_MAX = 500000 # 500kb

        bottle_app = APIBottle()
        self.bottle_app = bottle_app

        # JSON encoding for datetime objects
        # self.bottle_app.install(JSONPlugin(json_dumps=lambda s: json.dumps(s, cls=CustomJSONEncoder)))

        config = load_wr_config()

        # Init Redis
        if not redis_url:
            redis_url = os.environ['REDIS_BASE_URL']

        self.redis = redis.StrictRedis.from_url(redis_url, decode_responses=True)
        browser_redis = redis.StrictRedis.from_url(os.environ['REDIS_BROWSER_URL'], decode_responses=True)

        session_redis = redis.StrictRedis.from_url(os.environ['REDIS_SESSION_URL'])

        self.content_error_redirect = os.environ.get('CONTENT_ERROR_REDIRECT')

        # Init Jinja
        jinja_env = self.init_jinja_env(config)

        # Init Cork
        cork = WebRecCork.create_cork(self.redis, config)

        # User Manager
        user_manager = UserManager(redis=self.redis,
                                   cork=cork,
                                   config=config)

        # Init Browser Mgr
        browser_mgr = BrowserManager(config, browser_redis, user_manager)

        # Init Dat Share
        DatShare.dat_share = DatShare(self.redis)

        # Init Content Loader/Rewriter
        content_app = ContentController(app=bottle_app,
                                        jinja_env=jinja_env,
                                        user_manager=user_manager,
                                        config=config,
                                        browser_mgr=browser_mgr,
                                        redis=self.redis,
                                        cork=cork)

        # Init Sesion temp_prefix
        Session.temp_prefix = config['temp_prefix']

        kwargs = dict(app=bottle_app,
                      jinja_env=jinja_env,
                      user_manager=user_manager,
                      browser_mgr=browser_mgr,
                      content_app=content_app,
                      cork=cork,
                      redis=self.redis,
                      session_redis=session_redis,
                      config=config)

        # Init Core app controllers
        for controller_type in self.ALL_CONTROLLERS:
            x = controller_type(**kwargs)

        # Set Error Handler
        bottle_app.default_error_handler = self.make_err_handler(
                                            bottle_app.default_error_handler)

        final_app = RedisSessionMiddleware(bottle_app,
                                           cork,
                                           session_redis,
                                           config,
                                           access_cls=SessionAccessCache,
                                           access_redis=self.redis)

        final_app = WSGIProxMiddleware(final_app, '/_proxy/',
                                       proxy_host='webrecorder.proxy',
                                       proxy_options=self._get_proxy_options())

        kwargs['app'] = final_app

        super(MainController, self).__init__(**kwargs)

        self.browser_mgr = browser_mgr
        self.content_app = content_app

        wr_api_spec.build_api_spec()

    def _get_proxy_options(self):
        opts = {'ca_name': 'Webrecorder HTTPS Proxy CA'}
        if getattr(sys, 'frozen', False):
            opts['ca_file_cache'] = {}
        else:
            opts['ca_file_cache'] = './proxy-certs/webrecorder-ca.pem'

        # disable CONNECT keepalive for now
        opts['keepalive_max'] = -1

        return opts

    def init_jinja_env(self, config):
        assets_path = os.path.expandvars(config['assets_path'])
        packages = [os.environ.get('WR_TEMPLATE_PKG', 'webrecorder'), 'pywb']

        jinja_env_wrapper = JinjaEnv(assets_path=assets_path,
                                     packages=packages,
                                     env_template_params_key='webrec.template_params')

        jinja_env = jinja_env_wrapper.jinja_env

        jinja_env.globals['metadata'] = config.get('metadata', {})
        jinja_env.globals['static_path'] = 'static'

        def get_coll(context):
            return context.get('coll', '')

        def get_collection(context):
            coll = context.get('coll', '')
            coll_name = context.get('coll_name', '')
            user = get_user(context)
            return get_user(context).get_collection_by_id(coll, coll_name)

        def get_user(context):
            u = context.get('user', '')
            if not u:
                u = context.get('curr_user', '')
            return self.user_manager.all_users.make_user(u)

        def get_browsers():
            return self.browser_mgr.get_browsers()

        def get_app_host():
            return self.app_host or 'http://localhost:8089'

        def get_content_host():
            return self.content_host or 'http://localhost:8092'

        def get_num_collections():
            count = self.access.session_user.num_total_collections()
            return count

        def get_archives():
            return self.content_app.client_archives

        @contextfunction
        def is_public(context):
            return get_collection(context).is_public()

        @contextfunction
        def can_admin(context):
            return self.access.can_admin_coll(get_collection(context))

        @contextfunction
        def is_owner(context):
            res = self.access.is_curr_user(get_user(context))
            return res

        @contextfunction
        def can_write(context):
            res = self.access.can_write_coll(get_collection(context))
            return res

        @contextfunction
        def can_read(context):
            res = self.access.can_read_coll(get_collection(context))

        @contextfunction
        def is_anon(context):
            return self.access.session_user.is_anon()

        def get_announce_list():
            announce_list = os.environ.get('ANNOUNCE_MAILING_LIST', False)
            if announce_list:
                return announce_list
            return False

        @contextfunction
        def get_path(context, user, coll=None, rec=None):
            return self.get_path(user, coll, rec)

        @contextfunction
        def get_body_class(context, action):
            return self.get_body_class(context, action)

        @contextfunction
        def get_share_url(context):
            url = context.get('url')
            br = context.get('browser', '')
            user = context.get('user')
            coll = context.get('coll')
            host = self.app_host + ('' if self.app_host.endswith('/') else '/')
            ts = context.get('timestamp', '')

            if br != '':
                br = '$br:'+br

            return 'https://{host}{user}/{coll}/{ts}{browser}/{url}'.format(
                host=host,
                user=user,
                coll=coll,
                ts=ts,
                browser=br,
                url=url
            )

        @contextfunction
        def get_embed_url(context):
            host = self.app_host + ('' if self.app_host.endswith('/') else '/')
            url = context.get('url')
            br = context.get('browser', '')
            user = context.get('user')
            coll = context.get('coll')
            ts = context.get('timestamp', '')

            if br != '':
                br = '$br:'+br

            return 'https://{host}_embed/{user}/{coll}/{ts}{browser}/{url}'.format(
                host=host,
                user=user,
                coll=coll,
                ts=ts,
                browser=br,
                url=url
            )

        @contextfunction
        def get_recs_for_coll(context):
            collection = get_collection(context)

            return [{'ts': r['timestamp'], 'url': r['url'], 'br': r.get('browser', '')}
                    for r in collection.list_pages()]

        @contextfunction
        def is_out_of_space(context):
            return self.access.session_user.is_out_of_space()

        def trunc_url_expand(value):
            """ Truncate querystrings, appending an ellipses, expand on click
            """
            trunc_value = '?<span class="truncate-expand" aria-role="button" title="Click to expand" onclick="this.innerHTML=\''+value.split('?')[-1]+'\'; this.classList.add(\'open\');">...</span>'
            return re.sub(r'(\?.*)', trunc_value, value)

        def trunc_url(value):
            """ Truncate querystrings, appending an ellipses
            """
            return re.sub(r'(\?.*)', '?...', value)

        def urldecode(value):
            """ Decode url-encoded value
            """
            return unquote(value)


        jinja_env.globals['can_admin'] = can_admin
        jinja_env.globals['can_write'] = can_write
        jinja_env.globals['can_read'] = can_read
        #jinja_env.globals['can_tag'] = can_tag
        jinja_env.globals['is_owner'] = is_owner
        jinja_env.globals['is_anon'] = is_anon
        #jinja_env.globals['is_beta'] = is_beta
        jinja_env.globals['is_public'] = is_public
        jinja_env.globals['get_announce_list'] = get_announce_list
        jinja_env.globals['get_path'] = get_path
        jinja_env.globals['get_body_class'] = get_body_class
        jinja_env.globals['get_share_url'] = get_share_url
        jinja_env.globals['get_embed_url'] = get_embed_url
        jinja_env.globals['get_recs_for_coll'] = get_recs_for_coll
        jinja_env.globals['get_app_host'] = get_app_host
        jinja_env.globals['get_content_host'] = get_content_host
        jinja_env.globals['get_num_collections'] = get_num_collections
        jinja_env.globals['get_archives'] = get_archives
        jinja_env.globals['is_out_of_space'] = is_out_of_space
        jinja_env.globals['get_browsers'] = get_browsers
        #jinja_env.globals['is_extractable'] = is_extractable
        #jinja_env.globals['get_tags'] = get_tags
        #jinja_env.globals['is_tagged'] = is_tagged
        #jinja_env.globals['get_tags_in_collection'] = get_tags_in_collection
        jinja_env.filters['trunc_url'] = trunc_url
        jinja_env.filters['trunc_url_expand'] = trunc_url_expand
        jinja_env.filters['urldecode'] = urldecode

        return jinja_env_wrapper

    def init_routes(self):
        @self.bottle_app.route(['//<url:re:.*>'])
        def empty(url=''):
            self.redirect('/' + url)

        @self.bottle_app.route(['/<user>//<url:re:.*>'])
        def empty2(user, url=''):
            self.redirect('/' + user + '/' + url)

        @self.bottle_app.route(['/static/<path:path>', '/static_cors/<path:path>'])
        def static_files(path):
            res = static_file(path, root=self.static_root)

            if 'HTTP_ORIGIN' in request.environ:
                self.set_options_headers(None, None, res)

            return res

        @self.bottle_app.route('/_message')
        def flash_message():
            message = request.query.getunicode('message', '')
            msg_type = request.query.getunicode('msg_type', '')
            self.flash_message(message, msg_type)
            return {}

        @self.bottle_app.route('/api/v1.yml')
        def get_api_spec_yaml():
            response.content_type = 'text/yaml'
            return wr_api_spec.get_api_spec_yaml(self.access.is_superuser())

        @self.bottle_app.route('/api/v1.json')
        def get_api_spec_json():
            response.content_type = 'application/json'
            return json.dumps(wr_api_spec.get_api_spec_dict(self.access.is_superuser()))

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
            return res

        def err_handler(out):
            if out.status_code == 500:
                print(out.traceback)
            else:
                print(out)

            if out.status_code == 404 and self._check_refer_redirect():
                return

            # return html error view for any content errors
            if self.is_content_request() or out.status_code == 402 or 'wsgiprox.proxy_host' in request.environ:
                if self.content_error_redirect:
                    err_context = {'status': out.status_code,
                                   'error': out.body
                                  }

                    response.status = 303
                    redirect_url = self.content_error_redirect + '?' + urlencode(err_context)
                    response.set_header('Location', redirect_url)
                    return

                else:
                    if self._wrong_content_session_redirect():
                        return

                    return error_view(out)

            if isinstance(out.exception, dict):
                return json_error(out.exception)

            else:
                return json_error({'error': 'not_found'})

        return err_handler

    def _check_refer_redirect(self):
        referer = request.headers.get('Referer')
        if not referer:
            return

        if self.access.sesh.is_new():
            return

        if request.urlparts.path.startswith('/' + self.access.session_user.name):
            return

        if 'http' in request.urlparts.path or '///' in request.urlparts.path:
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

        init_logging()
