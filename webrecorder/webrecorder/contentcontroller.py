import os
import re
import base64
import requests
import json

from bottle import Bottle, request, redirect, HTTPError, response, HTTPResponse

from urlrewrite.rewriterapp import RewriterApp, UpstreamException
from urlrewrite.cookies import CookieTracker

from webrecorder.basecontroller import BaseController


# ============================================================================
class ContentController(BaseController, RewriterApp):
    DEF_REC_NAME = 'My First Recording'

    WB_URL_RX = re.compile('(([\d*]*)([a-z]+_)?/)?(https?:)?//.*')

    def __init__(self, app, jinja_env, manager, config):
        BaseController.__init__(self, app, jinja_env, manager, config)
        RewriterApp.__init__(self,
                             framed_replay=True,
                             jinja_env=jinja_env,
                             config=config)

        self.paths = config['url_templates']
        self.cookie_key_templ = config['cookie_key_templ']

        self.cookie_tracker = CookieTracker(manager.redis)

    def init_routes(self):
        # REDIRECTS
        @self.app.route(['/record/<wb_url:path>',
                         '/$temp/temp/record/<wb_url:path>',
                         '/$temp/temp/<rec>/record/<wb_url:path>'], method='ANY')
        def redir_anon_rec(rec='', wb_url=''):
            if not rec:
                rec = self.DEF_REC_NAME

            wb_url = self.add_query(wb_url)

            user = self.manager.get_anon_user(True)
            coll = 'temp'

            if not self.manager.has_collection(user, coll):
                self.manager.create_collection(user, coll, 'Temporary Collection')

            new_url = '/{user}/{coll}/{rec}/record/{url}'.format(user=user,
                                                                 coll=coll,
                                                                 rec=rec,
                                                                 url=wb_url)
            return self.redirect(new_url)

        # LIVE DEBUG
        @self.app.route('/live/<wb_url:path>', method='ANY')
        def live(wb_url):
            request.path_shift(1)

            return self.handle_routing(wb_url, user='$live', coll='temp', rec='', type='live')

        # LOGGED IN ROUTES
        @self.app.route('/<user>/<coll>/<rec>/record/<wb_url:path>', method='ANY')
        def logged_in_record(user, coll, rec, wb_url):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='record')

        @self.app.route('/<user>/<coll>/<rec>/patch/<wb_url:path>', method='ANY')
        def logged_in_patch(user, coll, rec, wb_url):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='patch')

        @self.app.route('/<user>/<coll>/<wb_url:path>', method='ANY')
        def logged_in_replay(user, coll, wb_url):
            rec_name = '*'

            # recording replay
            if not self.WB_URL_RX.match(wb_url) and '/' in wb_url:
                rec_name, wb_url = wb_url.split('/', 1)

            if rec_name == '*':
                request.path_shift(2)
                type_ = 'replay-coll'

            else:
                request.path_shift(3)
                type_ = 'replay'

            return self.handle_routing(wb_url, user, coll, rec=rec_name, type=type_)

    def handle_routing(self, wb_url, user, coll, rec, type):
        wb_url = self.add_query(wb_url)

        not_found = False

        if type in ('record', 'patch', 'replay'):
            if not self.manager.has_recording(user, coll, rec):
                not_found = True

            if type != 'replay':
                self.manager.assert_can_write(user, coll)

        if ((not_found or type == 'replay-coll') and
            (not (self.manager.is_anon(user) and coll == 'temp')) and
            (not self.manager.has_collection(user, coll))):

            self._redir_if_sanitized(self.sanitize_title(coll),
                                     coll,
                                     wb_url)

            raise HTTPError(404, 'No Such Collection')

        if not_found:
            title = rec
            rec = self.sanitize_title(title)

            if type == 'record' or type == 'patch':
                if rec == title or not self.manager.has_recording(user, coll, rec):
                    result = self.manager.create_recording(user, coll, rec, title)

            self._redir_if_sanitized(rec, title, wb_url)

            if type == 'replay':
                raise HTTPError(404, 'No Such Recording')

        return self.handle_load_content(wb_url, user, coll, rec, type)

    def handle_load_content(self, wb_url, user, coll, rec, type):
        wb_url = self._context_massage(wb_url)

        kwargs = dict(user=user,
                      coll=coll,
                      rec=rec,
                      type=type)

        try:
            resp = self.render_content(wb_url, kwargs, request.environ)

            resp = HTTPResponse(body=resp.body,
                                status=resp.status_headers.statusline,
                                headers=resp.status_headers.headers)
            return resp

        except UpstreamException as ue:
            @self.jinja2_view('content_error.html')
            def handle_error(status_code, type, url, err_info):
                response.status = status_code
                return {'url': url,
                        'status': status_code,
                        'error': err_info.get('error'),
                        'user': self.get_view_user(user),
                        'coll': coll,
                        'rec': rec,
                        'type': type
                       }

            return handle_error(ue.status_code, type, ue.url, ue.msg)

    def _redir_if_sanitized(self, id, title, wb_url):
        if id != title:
            target = self.get_host()
            target += request.script_name.replace(title, id)
            target += wb_url
            redirect(target)

    def _context_massage(self, wb_url):
        # reset HTTP_COOKIE to guarded request_cookie for LiveRewriter
        if 'webrec.request_cookie' in request.environ:
            request.environ['HTTP_COOKIE'] = request.environ['webrec.request_cookie']

        try:
            del request.environ['HTTP_X_PUSH_STATE_REQUEST']
        except:
            pass

        #TODO: generalize
        if wb_url.endswith('&spf=navigate') and wb_url.startswith('mp_/https://www.youtube.com'):
            wb_url = wb_url.replace('&spf=navigate', '')

        return wb_url

    def add_query(self, url):
        if request.query_string:
            url += '?' + request.query_string

        return url


    ## RewriterApp overrides
    def get_base_url(self, wb_url, kwargs):
        type = kwargs['type']

        if type in ('record', 'patch') and self.manager.is_out_of_space(kwargs['user']):
            details = {'error': 'Out of Space'}
            raise UpstreamException(402, url=wb_url.url, details=details)

        base_url = self.paths[type].format(record_host=self.record_host,
                                           replay_host=self.replay_host,
                                           **kwargs)

        return base_url

    def get_cookie_key(self, kwargs):
        return self.cookie_key_templ.format(**kwargs)

    def process_query_cdx(self, cdx, wb_url, kwargs):
        rec = kwargs.get('rec')
        if not rec or rec == '*':
            rec = cdx['source'].rsplit(':', 2)[-2]

        cdx['rec'] = rec

    def get_query_params(self, wb_url, kwargs):
        kwargs['user'] = self.get_view_user(kwargs['user'])
        return kwargs

    def get_top_frame_params(self, wb_url, kwargs):
        type = kwargs['type']
        if type == 'live':
            return {}

        # refresh cookie expiration,
        # disable until can guarantee cookie is not changed!
        #self.get_session().update_expires()

        info = self.manager.get_content_inject_info(kwargs['user'],
                                                    kwargs['coll'],
                                                    kwargs['rec'])

        return {'info': info,
                'curr_mode': type,
                'user': self.get_view_user(kwargs['user']),
                'coll': kwargs['coll'],
                'rec': kwargs['rec'],
                'coll_title': info.get('coll_title', ''),
                'rec_title': info.get('rec_title', '')
               }

    def _add_custom_params(self, cdx, resp_headers, kwargs):
        #type = kwargs['type']
        #if type in ('live', 'record'):
        #    cdx['is_live'] = 'true'

        if resp_headers.get('Webagg-Source-Coll') == 'live':
            cdx['is_live'] = 'true'

    def handle_custom_response(self, environ, wb_url, full_prefix, host_prefix, kwargs):
        @self.jinja2_view('browser_embed.html')
        def browser_embed(browser):  #pragma: no cover
            upstream_url = self.get_upstream_url('{url}',
                                                 wb_url,
                                                 wb_url.timestamp, kwargs)

            upsid = base64.b64encode(os.urandom(6))

            # TODO: load settings
            self.manager.browser_redis.setex(b'ups:' + upsid, 120, upstream_url)

            data = {'browser': browser,
                    'url': wb_url.url,
                    'ts': wb_url.timestamp,
                    'upsid': upsid.decode('utf-8'),
                    'static': '/static/__bp',
                   }

            data.update(self.get_top_frame_params(wb_url, kwargs))
            return data

        if wb_url.mod == 'ch_':
            return browser_embed('chrome')
        elif wb_url.mod == 'ff_':
            return browser_embed('firefox')

        return RewriterApp.handle_custom_response(self, environ, wb_url, full_prefix, host_prefix, kwargs)

