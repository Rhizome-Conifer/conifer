# standard library imports
import os
from functools import wraps

# third party imports
from six.moves.urllib.parse import quote
from bottle import HTTPError, redirect as bottle_redirect, request

# library specific imports
from webrecorder.utils import get_bool, sanitize_tag, sanitize_title


class BaseController(object):
    """Controller (base class).

    :ivar Bottle app: bottle application
    :ivar jinja_env: Jinja2 environment
    :ivar manager: n.s.
    :ivar dict config: Webrecorder configuration
    :ivar str app_host: application host
    :ivar str content_host: content host
    :ivar cache_template: Redis key template
    :ivar bool anon_disabled: whether anonymous recording is enabled
    """

    def __init__(self, app, jinja_env, manager, config):
        """Initialize controller.

        :param Bottle app: bottle application
        :param Environment jinja_env: Jinja2 environment
        :param manager: n.s.
        :param dict config: Webrecorder configuration
        """
        self.app = app
        self.jinja_env = jinja_env
        self.manager = manager
        self.config = config

        self.app_host = os.environ['APP_HOST']
        self.content_host = os.environ['CONTENT_HOST']
        self.cache_template = config.get('cache_template')
        self.anon_disabled = get_bool(os.environ.get('ANON_DISABLED'))

        self.init_routes()

    def init_routes(self):
        raise NotImplementedError

    def redir_host(self, host=None, path=None):
        """Cause a 303 or 302 redirect to the application host.

        :param str host: host
        :param str path: path
        """
        if not host:
            host = self.app_host

        if not host or request.environ.get('HTTP_HOST') == host:
            return

        url = request.environ['wsgi.url_scheme'] + '://' + host
        if not path:
            path = (
                request.environ.get('SCRIPT_NAME', '') +
                request.environ['PATH_INFO']
            )
            if request.query_string:
                path += '?' + request.query_string

        url += path
        return bottle_redirect(url)

    def validate_csrf(self):
        """Check CSRF token."""
        csrf = request.forms.getunicode('csrf')
        sesh_csrf = self.get_session().get_csrf()
        if not sesh_csrf or csrf != sesh_csrf:
            self._raise_error(403, 'Invalid CSRF Token')

    def get_user(self, api=False, redir_check=True):
        """Get user.

        :param bool api: n.s.
        :param bool redir_check: whether to cause a redirect to the application
        host

        :returns: user
        :rtype: str
        """
        if redir_check:
            self.redir_host()
        user = request.query.getunicode('user')
        if not user:
            self._raise_error(
                400, 'User must be specified', api=api
            )

        if user == '$temp':
            return self.manager.get_anon_user(True)

        if self.manager.is_anon(user):
            return user

        if not self.manager.has_user(user):
            self._raise_error(404, 'No such user', api=api)

        return user

    def get_user_coll(self, api=False, redir_check=True):
        """Get user and collection.

        :param bool api: n.s.
        :param bool redir_check: n.s.

        :returns: user and collection
        :rtype: str and str
        """
        user = self.get_user(api=api, redir_check=redir_check)

        coll = request.query.getunicode('coll')
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
        """Raise HTTP error.

        :param int code: status code
        :param str message: body
        :param bool api: toggle json_err attribute on/off
        """
        result = {'error_message': message}
        result.update(kwargs)

        if request.forms:
            result['request_data'] = dict(request.forms.decode())

        err = HTTPError(code, message, exception=result)
        if api:
            err.json_err = True
        raise err

    def get_session(self):
        """Get session.

        :returns: session
        :rtype: Session
        """
        return request.environ['webrec.session']

    def fill_anon_info(self, resp):
        """Update response w/ anonymous user information.

        :param dict resp: response

        :returns: success or failure
        :rtype: bool
        """
        sesh = self.get_session()

        resp['anon_disabled'] = self.anon_disabled

        if sesh.is_anon():
            anon_user = sesh.anon_user
            anon_coll = self.manager.get_collection(anon_user, 'temp')
            if anon_coll:
                resp['anon_user'] = anon_user
                resp['anon_size'] = anon_coll['size']
                resp['anon_recordings'] = len(anon_coll['recordings'])
                return True

        return False

    def flash_message(self, *args, **kwargs):
        """Set message.

        :returns: None
        :rtype: None
        """
        return self.get_session().flash_message(*args, **kwargs)

    def get_path(self, user, coll=None, rec=None):
        """Get path to user and/or collections and recordings.

        :param str user: user
        :param coll: collection
        :type: None or str
        :param rec: recording
        :type: None or str

        :returns: path
        :rtype: str
        """
        base = '/' + user

        if coll:
            if not base.endswith('/'):
                base += '/'

            base += coll

            if rec:
                base += '/' + rec

        return base

    def get_redir_back(self, skip, default='/'):
        """Get redirect.

        :param str skip: path causing redirect to default directory
        :param str default: default directory

        :returns: redirect
        :rtype: str
        """
        redir_to = request.headers.get('Referer', default)
        if redir_to.endswith(skip):
            redir_to = default
        return redir_to

    def post_get(self, name, default=''):
        """Get value from POST response.

        :param str name: key
        :param str default: default value

        :returns: value
        :rtype: str
        """
        res = request.POST.get(name, default).strip()
        if not res:
            res = default
        return res

    def get_host(self):
        """Get host.

        :returns: host
        :rtype: str
        """
        return self.manager.get_host()

    def redirect(self, url):
        """Cause redirect to URL.

        :param str url: URL
        """
        if url.startswith('/'):
            url = self.get_host() + quote(url, safe='+ /!:%?$=&#')

        return bottle_redirect(url)

    def jinja2_view(self, template_name, refresh_cookie=True):
        """Decorator factory.

        :param str template_name: template
        :param bool refresh_cookie: toggle refresh on/off
        """
        def decorator(view_func):
            #: @wraps preserves attributes such as __name__ and __doc__
            @wraps(view_func)
            def wrapper(*args, **kwargs):
                resp = view_func(*args, **kwargs)

                if isinstance(resp, dict):
                    ctx_params = request.environ.get('webrec.template_params')
                    if ctx_params:
                        resp.update(ctx_params)

                    template = self.jinja_env.jinja_env.get_or_select_template(
                        template_name
                    )
                    return template.render(**resp)
                else:
                    return resp

            return wrapper

        return decorator

    def sanitize_tag(self, tag):
        """Sanitize tag.

        :param str tag: tag

        :returns: sanitized tag
        :rtype: str
        """
        return sanitize_tag(tag)

    def sanitize_title(self, title):
        """Sanitize title.

        :param str title: title

        :returns: sanitized title
        :rtype: str
        """
        return sanitize_title(title)

    def get_view_user(self, user):
        """Get user.

        :param str user: user

        :returns: user
        :rtype: str
        """
        return user

    def get_body_class(self, context, action):
        """Get class(es).

        :param Context context: active context
        :param str action: action

        :returns: class(es)
        :rtype: str
        """
        classes = []

        if action in ["add_to_recording", "new_recording"]:
            classes.append("interstitial-page")

        if 'browser_data' in context:
            classes.append('cbrowser')

        return ' '.join(classes).strip()
