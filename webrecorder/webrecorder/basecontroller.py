from bottle import request, HTTPError
from functools import wraps

# ============================================================================
class BaseController(object):
    def __init__(self, app, jinja_env, manager):
        self.app = app
        self.jinja_env = jinja_env
        self.manager = manager

        self.init_routes()

    def init_routes(self):
        raise NotImplemented()

    def get_user_coll(self):
        user = request.query.get('user')
        coll = request.query.get('coll')
        if not user or not coll:
            self._raise_error(400, 'MissingUserColl',
                              'User and Collection must be specified')

        if user == '@anon':
            session = self.get_session()
            if not session.is_anon():
                session.set_anon()
            user = session.anon_user
            coll = 'anonymous'

        # for now, while only anon implemented
        else:
            self._raise_error(404, 'InvalidUserColl', 'No Such User or Collection')

        return user, coll

    def _raise_error(self, code, status_type, message):
        result = {'status': status_type, 'message': message}
        raise HTTPError(code, message, exception=result)

    def get_session(self):
        return request.environ['webrec.session']

    def jinja2_view(self, template_name):
        def decorator(view_func):
            @wraps(view_func)
            def wrapper(*args, **kwargs):
                resp = view_func(*args, **kwargs)

                if isinstance(resp, dict):
                    #ctx_params = request.environ.get('pywb.template_params')
                    #if ctx_params:
                    #    response.update(ctx_params)

                    template = self.jinja_env.jinja_env.get_or_select_template(template_name)
                    return template.render(**resp)
                else:
                    return resp

            return wrapper

        return decorator


