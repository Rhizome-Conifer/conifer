import re
import os

from bottle import request, HTTPError, redirect as bottle_redirect
from functools import wraps
from six.moves.urllib.parse import quote

from webrecorder.utils import sanitize_tag, sanitize_title, get_bool
from webrecorder.models import User


# ============================================================================
class BaseController(object):
    def __init__(self, *args, **kwargs):
        self.app = kwargs['app']
        self.jinja_env = kwargs['jinja_env']
        self.user_manager = kwargs['user_manager']
        self.config = kwargs['config']
        self.redis = kwargs['redis']

        self.app_host = os.environ['APP_HOST']
        self.content_host = os.environ['CONTENT_HOST']
        self.cache_template = self.config.get('cache_template')

        self.anon_disabled = get_bool(os.environ.get('ANON_DISABLED'))

        self.init_routes()

    def init_routes(self):
        raise NotImplemented()

    def redir_host(self, host=None, path=None):
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
        return bottle_redirect(url)

    def validate_csrf(self):
        csrf = request.forms.getunicode('csrf')
        sesh_csrf = self.get_session().get_csrf()
        if not sesh_csrf or csrf != sesh_csrf:
            self._raise_error(403, 'Invalid CSRF Token')

    def get_user(self, api=True, redir_check=True, user=None):
        if redir_check:
            self.redir_host()

        if not user:
            user = request.query.getunicode('user')

        if not user:
            self._raise_error(400, 'User must be specified',
                              api=api)

        try:
            user = self.user_manager.all_users[user]
        except Exception as e:
            self._raise_error(404, 'No such user', api=api)

        return user

    def load_user_coll(self, api=True, redir_check=True, user=None, coll_name=None):
        if not isinstance(user, User):
            user = self.get_user(api=api, redir_check=redir_check, user=user)

        if not coll_name:
            coll_name = request.query.getunicode('coll')

        if not coll_name:
            self._raise_error(400, 'Collection must be specified', api=api)

        if self.access.is_anon(user):
            if coll_name != 'temp':
                self._raise_error(404, 'No such collection', api=api)

        collection = user.get_collection_by_name(coll_name)
        if not collection:
            self._raise_error(404, 'No such collection', api=api)

        return user, collection

    def _raise_error(self, code, message, api=False, **kwargs):
        result = {'error_message': message}
        result.update(kwargs)

        if request.json:
            result['request_data'] = dict(request.json)

        err = HTTPError(code, message, exception=result)
        if api:
            err.json_err = True
        raise err

    def get_session(self):
        return request.environ['webrec.session']

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

