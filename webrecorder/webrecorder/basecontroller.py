import re
import os

from bottle import request, HTTPError, redirect as bottle_redirect, response
from functools import wraps
from six.moves.urllib.parse import quote

from webrecorder.utils import sanitize_tag, sanitize_title, get_bool
from webrecorder.models import User

from webrecorder.apiutils import api_decorator, wr_api_spec


class BaseController(object):
    def __init__(self, *args, **kwargs):
        self.app = kwargs['app']
        self.jinja_env = kwargs['jinja_env']
        self.user_manager = kwargs['user_manager']
        self.config = kwargs['config']
        self.anon_disabled = get_bool(os.environ.get('ANON_DISABLED'))

        self.init_routes()

    def init_routes(self):
        raise NotImplementedError

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

    def validate_csrf(self):
        """Check CSRF token."""
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

    def _raise_error(self, code, message='not_found'):
        result = {'error': message}
        response.status = code

        raise HTTPError(code, message, exception=result)

    def get_session(self):
        """Get session.

        :returns: session
        :rtype: Session
        """
        return request.environ['webrec.session']

    def fill_anon_info(self, resp):
<<<<<<< ours
        """Update response w/ anonymous user information.

        :param dict resp: response

        :returns: success or failure
        :rtype: bool
        """
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
<<<<<<< ours
        """Get host.

        :returns: host
        :rtype: str
        """
        return request.urlparts.scheme + '://' + request.urlparts.netloc

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

    @property
    def access(self):
        return request.environ['webrec.access']

