import os

from bottle import request, HTTPError, redirect as bottle_redirect, response
from functools import wraps
from six.moves.urllib.parse import quote, urlencode

from webrecorder.utils import sanitize_tag, sanitize_title, get_bool
from webrecorder.models import User

from webrecorder.apiutils import api_decorator, wr_api_spec


# ============================================================================
class BaseController(object):
    SKIP_REDIR_LOCK_KEY = '__skip:{id}:{url}'
    SKIP_REDIR_LOCK_TTL = 10

    def __init__(self, *args, **kwargs):
        self.app = kwargs['app']
        self.jinja_env = kwargs['jinja_env']
        self.user_manager = kwargs['user_manager']
        self.config = kwargs['config']
        self.redis = kwargs['redis']
        self.cork = kwargs['cork']

        self.api = api_decorator

        self.app_host = os.environ.get('APP_HOST', '')
        self.content_host = os.environ.get('CONTENT_HOST', '')
        self.cache_template = self.config.get('cache_template')

        self.anon_disabled = get_bool(os.environ.get('ANON_DISABLED'))

        self.allow_beta_features_role = os.environ.get('ALLOW_BETA_FEATURES_ROLE', 'beta-archivist')

        self.init_routes()

    def init_routes(self):
        raise NotImplemented()

    def redir_host(self, host=None, path=None, status=None):
        if not host:
            host = self.app_host

        if not host or request.environ.get('HTTP_HOST') == host:
            return

        url = request.environ['wsgi.url_scheme'] + '://' + host
        if not path:
            path = request.environ.get('SCRIPT_NAME', '') + request.environ['PATH_INFO']
            if request.query_string:
                path += '?' + request.query_string

        url += path
        return bottle_redirect(url, code=status)

    def is_content_request(self):
        if not self.content_host:
            return False

        return request.environ.get('HTTP_HOST') == self.content_host

    def _wrong_content_session_redirect(self):
        """ Determine if this may be an incorrect content session
        for the current app session. If so, redirect to /_set_session
        to reset cookie
        """

        # only applies if app_host and content_host are different
        if not self.app_host or not self.content_host:
            return False

        # must have a referrer
        referrer = request.headers.get('Referer')
        if not referrer:
            return False

        request_uri = request.environ['REQUEST_URI']

        # request must contain mp_/ modifier
        if 'mp_/' not in request_uri:
            return False

        app_prefix = request.environ['wsgi.url_scheme'] + '://' + self.app_host

        # referrer must be from the app host, start with app_prefix
        if not referrer.startswith(app_prefix):
            return False

        # additional 'lock' to avoid redirect loop, if already just redirected
        # (key should be set for 10 secs) we already have the correct session,
        # return a regular 404
        skip_key = self.SKIP_REDIR_LOCK_KEY.format(url=request_uri, id=self.get_session().get_id())
        if not self.redis.set(skip_key, 1, nx=True, ex=self.SKIP_REDIR_LOCK_TTL):
            return False

        # redirect to /_set_session, include content_cookie
        query = {
                 'path': request_uri,
                 'content_cookie': request.environ.get('webrec.sesh_cookie', '')
                }

        redir_url = app_prefix + '/_set_session?' + urlencode(query)

        response.status = 307
        response.set_header('Location', redir_url)
        return True

    def validate_csrf(self):
        csrf = request.forms.getunicode('csrf')
        sesh_csrf = self.get_session().get_csrf()
        if not sesh_csrf or csrf != sesh_csrf:
            self._raise_error(403, 'invalid_csrf_token')

    def get_user(self, api=True, redir_check=True, user=None):
        if redir_check:
            self.redir_host()

        if not user:
            user = request.query.getunicode('user')

        if not user:
            self._raise_error(400, 'no_user_specified')

        try:
            user = self.user_manager.all_users[user]
        except Exception as e:
            msg = 'not_found' if user == 'api' else 'no_such_user'
            self._raise_error(404, msg)

        return user

    def load_user_coll(self, api=True, redir_check=True, user=None, coll_name=None):
        if not isinstance(user, User):
            user = self.get_user(api=api, redir_check=redir_check, user=user)

        if not coll_name:
            coll_name = request.query.getunicode('coll')

        if not coll_name:
            self._raise_error(400, 'no_collection_specified')

        collection = user.get_collection_by_name(coll_name)
        if not collection:
            self._raise_error(404, 'no_such_collection')

        return user, collection

    def require_admin_beta_access(self, collection=None):
        """
        Ensure user has at least beta-archivist privs
        and is also admin on the collection, if provided
        """
        try:
            if self.allow_beta_features_role:
                self.cork.require(role=self.allow_beta_features_role)

            if collection:
                self.access.assert_can_admin_coll(collection)
        except:
            self._raise_error(400, 'not_allowed')

    def _raise_error(self, code, message='not_found'):
        result = {'error': message}
        #result.update(kwargs)
        response.status = code

        raise HTTPError(code, message, exception=result)

    def get_session(self):
        return request.environ['webrec.session']

    def set_options_headers(self, origin_host, target_host, response_obj=None):
        origin = request.environ.get('HTTP_ORIGIN')

        if origin_host:
            expected_origin = request.environ['wsgi.url_scheme'] + '://' + origin_host

            # ensure origin is the content host origin
            if origin != expected_origin:
                return False

        host = request.environ.get('HTTP_HOST')
        # ensure host is the app host
        if target_host and host != target_host:
            return False

        headers = response.headers if not response_obj else response_obj.headers

        headers['Access-Control-Allow-Origin'] = origin if origin_host else '*'

        methods = request.environ.get('HTTP_ACCESS_CONTROL_REQUEST_METHOD')
        if methods:
            headers['Access-Control-Allow-Methods'] = methods

        req_headers = request.environ.get('HTTP_ACCESS_CONTROL_REQUEST_HEADERS')
        if req_headers:
            headers['Access-Control-Allow-Headers'] = req_headers

        headers['Access-Control-Allow-Credentials'] = 'true'
        headers['Access-Control-Max-Age'] = '1800'
        return True

    def fill_anon_info(self, resp):
        resp['anon_disabled'] = self.anon_disabled

        if self.access.session_user.is_anon():
            anon_coll = self.access.session_user.get_collection_by_name('temp')
            if anon_coll:
                resp['anon_user'] = self.access.session_user.name
                resp['anon_size'] = anon_coll.size
                resp['anon_recordings'] = anon_coll.num_recordings()
                return True

        return False

    def flash_message(self, *args, **kwargs):
        return self.get_session().flash_message(*args, **kwargs)

    def get_path(self, user, coll=None, rec=None):
        base = '/' + user

        if coll:
            if not base.endswith('/'):
                base += '/'

            base += coll

            if rec:
                base += '/' + rec

        return base

    def get_redir_back(self, skip, default='/'):
        redir_to = request.headers.get('Referer', default)
        if redir_to.endswith(skip):
            redir_to = default
        return redir_to

    def post_get(self, name, default=''):
        res = request.POST.get(name, default).strip()
        if not res:
            res = default
        return res

    def get_host(self):
        return request.urlparts.scheme + '://' + request.urlparts.netloc

    def redirect(self, url):
        if url.startswith('/'):
            url = self.get_host() + quote(url, safe='+ /!:%?$=&#')

        return bottle_redirect(url)

    def jinja2_view(self, template_name, refresh_cookie=True):
        def decorator(view_func):
            @wraps(view_func)
            def wrapper(*args, **kwargs):
                resp = view_func(*args, **kwargs)

                if isinstance(resp, dict):
                    ctx_params = request.environ.get('webrec.template_params')
                    if ctx_params:
                        resp.update(ctx_params)

                    template = self.jinja_env.jinja_env.get_or_select_template(template_name)
                    return template.render(**resp)
                else:
                    return resp

            return wrapper

        return decorator

    def sanitize_tag(self, tag):
        return sanitize_tag(tag)

    def sanitize_title(self, title):
        return sanitize_title(title)

    def get_body_class(self, context, action):
        classes = []

        if action in ["add_to_recording", "new_recording"]:
            classes.append("interstitial-page")

        if 'browser_data' in context:
            classes.append('cbrowser')

        return ' '.join(classes).strip()

    @property
    def access(self):
        return request.environ['webrec.access']

