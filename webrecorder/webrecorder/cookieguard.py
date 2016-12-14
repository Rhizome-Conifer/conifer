from time import strftime, gmtime


# ============================================================================
class CookieGuard(object):
    def __init__(self, app, sesh_key):
        self.app = app
        self.sesh_key = sesh_key

    def __call__(self, environ, start_response):
        self.init_session(environ)

        def guard_start_response(status, headers, exc_info=None):
            self.prepare_response(environ, headers)
            if not environ.get('webrec.ws_closed'):
                return start_response(status, headers, exc_info)

        return self.app(environ, guard_start_response)

    def init_session(self, environ):
        self.split_cookie(environ)

    def prepare_response(self, environ, headers):
        res = environ.get('webrec.delete_all_cookies')
        if res:
            self.delete_all_cookies(environ, headers, res)

    def delete_all_cookies(self, environ, headers, type_):
        cookie_header = environ.get('webrec.request_cookie')
        if not cookie_header:
            cookie_header = environ.get('HTTP_COOKIE')

        if not cookie_header:
            return

        all_cooks = cookie_header.split(';')

        for cook in all_cooks:
            cook = cook.split('=')[0]
            if type_ != 'all' and cook == self.sesh_key:
                continue

            self._delete_cookie(headers, cook)

    def _delete_cookie(self, headers, name):
        expires = strftime("%a, %d-%b-%Y %T GMT", gmtime(10))
        buff = '{0}=deleted; Expires={1}; Path=/'.format(name, expires)
        headers.append(('Set-Cookie', buff))

    def split_cookie(self, environ):
        cookie = environ.get('HTTP_COOKIE')

        if not cookie:
            return

        sesh_cookie = self.extract_cookie(cookie, self.sesh_key)
        if sesh_cookie:
            cookie = cookie.replace(sesh_cookie, '').strip('; ')

        environ['webrec.request_cookie'] = cookie
        environ['HTTP_COOKIE'] = sesh_cookie
        return sesh_cookie

    @staticmethod
    def extract_cookie(cookie_header, cookie_name):
        inx = cookie_header.find(cookie_name)
        if inx >= 0:
            end_inx = cookie_header.find(';', inx)
            if end_inx > 0:
                value = cookie_header[inx:end_inx]
            else:
                value = cookie_header[inx:]

            return value
        return ''


