# standard library imports
import os
import re
import sys
import json

# third party imports
import redis
from pkg_resources import resource_filename
from six.moves.urllib.parse import unquote, urljoin
from bottle import Bottle, debug, JSONPlugin, request, response, static_file
from jinja2 import contextfunction
from wsgiprox.wsgiprox import WSGIProxMiddleware
from pywb.rewrite.templateview import JinjaEnv

# library specific imports
from webrecorder.utils import init_logging, load_wr_config
from webrecorder.session import RedisSessionMiddleware, Session
from webrecorder.apiutils import CustomJSONEncoder
from webrecorder.redisman import RedisDataManager
from webrecorder.webreccork import WebRecCork
from webrecorder.basecontroller import BaseController
from webrecorder.browsermanager import BrowserManager
from webrecorder.recscontroller import RecsController
from webrecorder.usercontroller import UserController
from webrecorder.collscontroller import CollsController
from webrecorder.logincontroller import LoginController
from webrecorder.uploadcontroller import UploadController
from webrecorder.contentcontroller import ContentController
from webrecorder.websockcontroller import WebsockController
from webrecorder.downloadcontroller import DownloadController
from webrecorder.snapshotcontroller import SnapshotController
from webrecorder.bugreportcontroller import BugReportController


class AppController(BaseController):
    """Application controller.

    :cvar list ALL_CONTROLLERS: list of controllers
    :ivar str static_root: root directory
    :ivar Bottle bottle_app: bottle application
    :ivar StrictRedis redis: Redis interface
    :ivar StrictRedis browser_redis: Redis interface
    :ivar StrictRedis session_redis: Redis interface
    :ivar str init_upload_id: upload ID
    :ivar str init_upload_user: upload username
    :ivar str init_upload_coll: upload collection title
    :ivar ContentController content_app: content controller
    :ivar BrowserManager browser_manager: browser manager
    :ivar WebRecCork cork: Webrecorder authentication, authorization
    and accounting
    """
    ALL_CONTROLLERS = [
        DownloadController,
        UploadController,
        LoginController,
        UserController,
        BugReportController,
        SnapshotController,
        WebsockController,
        RecsController,
        CollsController
    ]

    def __init__(self, redis_url=None):
        """Initialize application controller.

        :param str redis_url: Redis URL
        """
        self._init_logging()
        if getattr(sys, 'frozen', False):
            self.static_root = os.path.join(
                sys._MEIPASS, 'webrecorder', 'static/'
            )
        else:
            self.static_root = resource_filename('webrecorder', 'static/')
        bottle_app = Bottle()
        self.bottle_app = bottle_app
        # JSON encoding for datetime objects
        self.bottle_app.install(
            JSONPlugin(
                json_dumps=lambda s: json.dumps(s, cls=CustomJSONEncoder)
            )
        )
        config = load_wr_config()
        # Init Redis
        if not redis_url:
            redis_url = os.environ['REDIS_BASE_URL']
        self.redis = redis.StrictRedis.from_url(
            redis_url, decode_responses=True
        )
        self.browser_redis = redis.StrictRedis.from_url(
            os.environ['REDIS_BROWSER_URL'], decode_responses=True
        )
        self.session_redis = redis.StrictRedis.from_url(
            os.environ['REDIS_SESSION_URL']
        )
        # Auto Upload on Init Id
        self.init_upload_id = config.get('init_upload_id')
        self.init_upload_user = config.get('init_upload_user')
        self.init_upload_coll = config.get('init_upload_coll')
        # Init Jinja
        jinja_env = self.init_jinja_env(config)
        # Init Content Loader/Rewriter
        self.content_app = ContentController(
            app=bottle_app,
            jinja_env=jinja_env,
            config=config,
            redis=self.redis
        )
        # Init Browser Mgr
        self.browser_mgr = BrowserManager(
            config, self.browser_redis, self.content_app
        )
        # Init Cork
        self.cork = WebRecCork.create_cork(self.redis, config)
        # Init Manager
        manager = RedisDataManager(
            self.redis, self.cork, self.content_app,
            self.browser_redis, self.browser_mgr, config
        )
        # Init Sesion temp_prefix
        Session.TEMP_PREFIX = config['temp_prefix']
        # Init Core app controllers
        for controller_type in self.ALL_CONTROLLERS:
            controller_type(
                app=bottle_app,
                jinja_env=jinja_env,
                manager=manager,
                config=config
            )
        # Set Error Handler
        bottle_app.default_error_handler = self.make_err_handler(
            bottle_app.default_error_handler
        )
        final_app = RedisSessionMiddleware(
            bottle_app, self.cork, self.session_redis, config
        )
        final_app = WSGIProxMiddleware(
            final_app,
            '/_proxy/',
            proxy_host='webrecorder.proxy',
            proxy_options=self._get_proxy_options()
        )
        super().__init__(final_app, jinja_env, manager, config)
        return

    def _get_proxy_options(self):
        """Get proxy options.

        :returns: proxy options
        :rtype: dict
        """
        opts = {'ca_name': 'Webrecorder HTTPS Proxy CA'}
        if getattr(sys, 'frozen', False):
            opts['ca_file_cache'] = {}
        else:
            opts['ca_file_cache'] = './proxy-certs/webrecorder-ca.pem'

        return opts

    def init_jinja_env(self, config):
        """Initialize Jinja2 environment.

        :param dict config: configuration

        :returns: Jinja2 environment
        :rtype: Environment
        """
        assets_path = os.path.expandvars(config['assets_path'])
        packages = [os.environ.get('WR_TEMPLATE_PKG', 'webrecorder'), 'pywb']
        jinja_env_wrapper = JinjaEnv(
            assets_path=assets_path,
            packages=packages,
            env_template_params_key='webrec.template_params'
        )
        jinja_env = jinja_env_wrapper.jinja_env
        jinja_env.globals['metadata'] = config.get('metadata', {})
        jinja_env.globals['static_path'] = 'static'

        def get_coll(context):
            """Get collection.

            :param Context context: active context

            :returns: collection
            :rtype: str
            """
            coll = context.get('coll_orig', '')
            if not coll:
                coll = context.get('coll', '')
            return coll

        def get_user(context):
            """Get user.

            :param Context context: active context

            :returns: user
            :rtype: str
            """
            u = context.get('user', '')
            if not u:
                u = context.get('curr_user', '')
            return u

        def get_browsers():
            """Get browsers.

            :returns: browsers
            :rtype: dict
            """
            return self.browser_mgr.get_browsers()

        def get_tags():
            """Get tags.

            :returns: tags
            """
            return self.manager.get_available_tags()

        def get_tags_in_collection(user, coll):
            """Get collection tags.

            :param str user: user
            :param str coll: collection

            :returns: collection tags
            """
            return self.manager.get_tags_in_collection(user, coll)

        def get_app_host():
            """Get application host.

            :returns: application host
            :rtype: str
            """
            return self.app_host

        def get_content_host():
            """Get content host.

            :returns: content host
            :rtype: str
            """
            return self.content_host

        def get_num_collections():
            """Get number of collections (current user).

            :returns: number of collections
            :rtype: int
            """
            curr_user = self.manager.get_curr_user()
            count = self.manager.num_collections(curr_user) if curr_user else 0
            return count

        def get_archives():
            """Get archives.

            :returns: archives
            """
            return self.content_app.client_archives

        def is_beta():
            """Determine whether the role 'beta-archivist' is required.

            :returns: state
            :rtype: bool
            """
            return self.manager.is_beta()

        def can_tag():
            """Determine whether the role 'beta-archivist' is required.

            :returns: state
            :rtype: bool
            """
            return self.manager.can_tag()

        def is_public(user, coll):
            """Determine whether the collection is public.

            :param str user: user
            :param str collection: collection

            :returns: state
            :rtype: str
            """
            return self.manager.is_public(user, coll)

        @contextfunction
        def can_admin(context):
            """Determine whether the current user can administrate the
            current collect.

            :param Context context: active context

            :returns: state
            :rtype: bool
            """
            return self.manager.can_admin_coll(
                get_user(context), get_coll(context)
            )

        @contextfunction
        def is_owner(context):
            """Determine whether the current user is the owner of the
            session.

            :param Context context: active context

            :returns: state
            :rtype: bool
            """
            return self.manager.is_owner(get_user(context))

        @contextfunction
        def can_write(context):
            """Determine whether the current user has write permissions for the
            current session.

            :param Context context: context

            :returns: state
            :rtype: bool
            """
            res = self.manager.can_write_coll(
                get_user(context), get_coll(context)
            )
            return res

        @contextfunction
        def can_read(context):
            """Determine whether the current user has read permissions for the
            current session.

            :param Context context: context

            :returns: state
            :rtype: bool
            """
            return self.manager.can_read_coll(
                get_user(context), get_coll(context)
            )

        @contextfunction
        def is_extractable(context):
            """Determine whether the current user can extract the
            current collection.

            :param Context context: context

            :returns: state
            :rtype: bool
            """
            return self.manager.is_extractable(
                get_user(context), get_coll(context)
            )

        @contextfunction
        def is_anon(context):
            """Determine whether the current user is an anonymous user.

            :param Context context: context

            :returns: state
            :rtype: bool
            """
            return self.manager.is_anon(get_user(context))

        def get_announce_list():
            """Get POST resource.

            :returns: POST resource or False
            :rtype: str or bool
            """
            announce_list = os.environ.get('ANNOUNCE_MAILING_LIST', False)
            if announce_list:
                return announce_list
            return False

        @contextfunction
        def get_path(context, user, coll=None, rec=None):
            """Get path.

            :param Context context: active context
            :param str user: user
            :param str coll: collection
            :param str rec: recording

            :returns: path
            :rtype: str
            """
            return self.get_path(user, coll, rec)

        @contextfunction
        def get_body_class(context, action):
            """Get body class.

            :param Context context: active context
            :param str action: action

            :returns: body class
            :rtype: str
            """
            return self.get_body_class(context, action)

        @contextfunction
        def get_share_url(context):
            """Get URL used to share collection.

            :param Context context: active context

            :returns: URL
            :rtype: str
            """
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
            """Get URL used to embed collection.

            :param Context contex: active context

            :returns: URL
            :rtype: str
            """
            host = self.app_host + ('' if self.app_host.endswith('/') else '/')
            url = context.get('url')
            br = context.get('browser', '')
            user = context.get('user')
            coll = context.get('coll')
            ts = context.get('timestamp', '')
            if br != '':
                br = '$br:' + br
            embed_url = (
                'https://{host}_embed/{user}/{coll}/{ts}{browser}/{url}'
            )
            embed_url = embed_url.format(
                host=host,
                user=user,
                coll=coll,
                ts=ts,
                browser=br,
                url=url
            )

            return embed_url

        @contextfunction
        def get_recs_for_coll(context):
            """Get records in collection.

            :param Context context: active context

            :returns: records
            :rtype: list
            """
            user = context.get('user')
            coll = get_coll(context)
            recs = [
                {
                    'ts': r['timestamp'],
                    'url': r['url'],
                    'br': r.get('browser', '')
                } for r in self.manager.list_coll_pages(user, coll)
            ]
            return recs

        @contextfunction
        def is_out_of_space(context):
            """Determine whether the current user is out of space.

            :param Context context: active context

            :returns: state
            :rtype: bool
            """
            return self.manager.is_out_of_space(context.get('curr_user', ''))

        @contextfunction
        def is_tagged(context, bookmark_id):
            """Determine whether the bookmark ID is tagged.

            :param Context context: context
            :param str bookmark ID: bookmark ID

            :returns: state
            :rtype: bool
            """
            available = context.get('available_tags', [])
            tags = context.get('tags', [])

            for tag in available:
                if tag in tags and bookmark_id in tags[tag]:
                    return True
            return False

        def trunc_url_expand(value):
            """Truncate query string, and append an ellipsis as well as
            expanding on mouse click.

            :param str value: query string

            :returns: truncated query string
            :rtype: str
            """
            trunc_value = (
                '?<span class="truncate-expand" aria-role="button" ' +
                'title="Click to expand" onclick="this.innerHTML=\'' +
                value.split('?')[-1] +
                '\'; this.classList.add(\'open\');">...</span>'
            )
            return re.sub(r'(\?.*)', trunc_value, value)

        def trunc_url(value):
            """Truncate query string, and append an ellipsis.

            :param str value: query string

            :returns: truncated query string
            :rtype: str
            """
            return re.sub(r'(\?.*)', '?...', value)

        def urldecode(value):
            """Decode URL-encoded value.

            :param str value: value

            :returns: decoded value
            :rtype: str
            """
            return unquote(value)

        jinja_env.globals['can_admin'] = can_admin
        jinja_env.globals['can_write'] = can_write
        jinja_env.globals['can_read'] = can_read
        jinja_env.globals['can_tag'] = can_tag
        jinja_env.globals['is_owner'] = is_owner
        jinja_env.globals['is_anon'] = is_anon
        jinja_env.globals['is_beta'] = is_beta
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
        jinja_env.globals['is_extractable'] = is_extractable
        jinja_env.globals['get_tags'] = get_tags
        jinja_env.globals['is_tagged'] = is_tagged
        jinja_env.globals['get_tags_in_collection'] = get_tags_in_collection
        jinja_env.filters['trunc_url'] = trunc_url
        jinja_env.filters['trunc_url_expand'] = trunc_url_expand
        jinja_env.filters['urldecode'] = urldecode
        return jinja_env_wrapper

    def init_routes(self):
        """Initialize URL paths."""

        @self.bottle_app.route(['//<url:re:.*>'])
        def empty(url=''):
            """Cause a redirect.

            :param str url: URL
            """
            self.redirect('/' + url)
            return

        @self.bottle_app.route(['/<user>//<url:re:.*>'])
        def empty2(user, url=''):
            """Cause a redirect.

            :param str url: URL
            """
            self.redirect('/' + user + '/' + url)
            return

        @self.bottle_app.route(['/', '/index.html'])
        @self.jinja2_view('index.html', refresh_cookie=False)
        def home_page():
            """Cause a redirect to the home page.

            :returns: response
            :rtype: dict
            """
            self.redir_host()
            resp = {'is_home': '1'}
            if self.init_upload_id:
                return self.handle_player_load(resp)
            curr_user = self.manager.get_curr_user()
            if curr_user:
                coll_list = self.manager.get_collections(curr_user)
                resp['collections'] = coll_list
                resp['coll_title'] = ''
                resp['rec_title'] = ''
            else:
                self.fill_anon_info(resp)
            return resp

        @self.bottle_app.route('/_faq')
        @self.jinja2_view('faq.html')
        def faq():
            """Cause a redirect to the FAQ.

            :returns: response
            :rtype: dict
            """
            return {}

        @self.bottle_app.route('/_documentation')
        @self.jinja2_view('howtoguide.html')
        def documentation():
            """Cause a redirect to the documentation.

            :returns: response
            :rtype: dict
            """
            return {}

        @self.bottle_app.route('/static/<path:path>')
        def static_files(path):
            """Serve static files.

            :param str path: path
            """
            return static_file(path, root=self.static_root)

        @self.bottle_app.route('/_message')
        def flash_message():
            """Bind to request URL displaying message.

            :returns: response
            :rtype: dict
            """
            message = request.query.getunicode('message', '')
            msg_type = request.query.getunicode('msg_type', '')
            self.flash_message(message, msg_type)
            return {}

        @self.bottle_app.route('/_policies')
        @self.jinja2_view('policies.html')
        def policies():
            """Cause a redirect to the policies.

            :returns: response
            :rtype: dict
            """
            return {}

        @self.bottle_app.route('/<:re:.*>', method='ANY')
        def fallthrough():
            """Bind to request URL in HTTP referer.

            :returns: response
            :rtype: dict
            """
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
            if (isinstance(out.exception, dict) and hasattr(out, 'json_err')):
                return json_error(out.exception)
            else:
                if out.status_code == 404:
                    start_path = request.environ.get('SCRIPT_NAME')
                    if not start_path:
                        start_path = request.environ.get('PATH_INFO')

                    if start_path.startswith('/' + self.manager.temp_prefix):
                        res = error_view(out, is_temp=True)
                        return res

                    if self._check_refer_redirect():
                        return

                if out.status_code == 500:
                    print(out.traceback)

                return error_view(out)

        return err_handler

    def handle_player_load(self, resp):
        """ Initial warc load for player
        """
        user = self.init_upload_user
        coll = self.init_upload_coll
        upload_id = self.init_upload_id

        upload_status = self.manager.get_upload_status(user, upload_id)

        # if upload already finished, redirect to known coll
        if not upload_status or upload_status.get('done'):
            if user and coll:
                self.redirect('/' + user + '/' + coll)

        resp['upload_status'] = upload_status
        return resp

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

        init_logging()
