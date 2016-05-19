from bottle import request, HTTPError, redirect as bottle_redirect
from functools import wraps
import re
import os


# ============================================================================
class BaseController(object):
    ALPHA_NUM_RX = re.compile('[^\w-]')

    WB_URL_COLLIDE = re.compile('^([\d]+([\w]{2}_)?|([\w]{2}_))$')

    def __init__(self, app, jinja_env, manager, config):
        self.app = app
        self.jinja_env = jinja_env
        self.manager = manager
        self.config = config

        self.init_routes()

    def init_routes(self):
        raise NotImplemented()

    def get_user(self, api=False):
        user = request.query.get('user')
        if not user:
            self._raise_error(400, 'User must be specified',
                              api=api)

        if self.manager.is_anon(user):
            return user

        if not self.manager.has_user(user):
            self._raise_error(404, 'No such user', api=api)

        return user

    def get_user_coll(self, api=False):
        user = self.get_user(api=api)

        coll = request.query.get('coll')
        if not coll:
            self._raise_error(400, 'Collection must be specified',
                              api=api)

        if self.manager.is_anon(user):
            if coll != 'temp':
                self._raise_error(404, 'No such collection', api=api)

        elif not self.manager.has_collection(user, coll):
            self._raise_error(404, 'No such collection', api=api)

        return user, coll

    def _raise_error(self, code, message, api=False, **kwargs):
        result = {'error_message': message}
        result.update(kwargs)
        err = HTTPError(code, message, exception=result)
        if api:
            err.json_err = True
        raise err

    def get_session(self):
        return request.environ['webrec.session']

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
        return self.manager.get_host()

    def redirect(self, url):
        if url.startswith('/'):
            url = self.get_host() + url

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

                    #if refresh_cookie:
                    #    sesh = self.get_session().update_expires()

                    template = self.jinja_env.jinja_env.get_or_select_template(template_name)
                    return template.render(**resp)
                else:
                    return resp

            return wrapper

        return decorator

    def sanitize_title(self, title):
        id = title.lower()
        id = id.replace(' ', '-')
        id = self.ALPHA_NUM_RX.sub('', id)
        if self.WB_URL_COLLIDE.match(id):
            id += '_'

        return id

    @property
    def record_host(self):
        return os.environ['RECORD_HOST']

    @property
    def replay_host(self):
        return os.environ['WEBAGG_HOST']

    def get_view_user(self, user):
        return user

    def get_body_class(self, action):
        if action in ["add_to_recording", "new_recording"]:
            return "interstitial-page"
        else:
            return ""


