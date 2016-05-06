import os
import re
import base64
import requests
import json

from six.moves.urllib.parse import quote

from bottle import Bottle, request, redirect, HTTPError, response, HTTPResponse

from pywb.utils.timeutils import timestamp_now

from urlrewrite.rewriterapp import RewriterApp, UpstreamException

from webrecorder.basecontroller import BaseController

from webagg.utils import StreamIter
from io import BytesIO


# ============================================================================
class ContentController(BaseController, RewriterApp):
    DEF_REC_NAME = 'My First Recording'

    PATHS = {'live': '{replay_host}/live/resource/postreq?url={url}&closest={closest}',
             'record': '{record_host}/record/live/resource/postreq?url={url}&closest={closest}&param.user={user}&param.coll={coll}&param.rec={rec}',
             'patch': '{record_host}/record/patch/resource/postreq?url={url}&closest={closest}&param.user={user}&param.coll={coll}&param.rec={rec}',
             'replay': '{replay_host}/replay/resource/postreq?url={url}&closest={closest}&param.replay.user={user}&param.replay.coll={coll}&param.replay.rec={rec}',
             'replay-coll': '{replay_host}/replay-coll/resource/postreq?url={url}&closest={closest}&param.user={user}&param.coll={coll}',

             'download': '{record_host}/download?user={user}&coll={coll}&rec={rec}&filename={filename}&type={type}',
             'download_filename': '{title}-{timestamp}.warc.gz'
            }

    WB_URL_RX = re.compile('(([\d*]*)([a-z]+_)?/)?(https?:)?//.*')

    def __init__(self, app, jinja_env, manager, config):
        self.record_host = os.environ['RECORD_HOST']
        self.replay_host = os.environ['WEBAGG_HOST']

        BaseController.__init__(self, app, jinja_env, manager, config)
        RewriterApp.__init__(self,
                             framed_replay=True,
                             jinja_env=jinja_env,
                             config=config)

    def init_routes(self):
        # REDIRECTS
        @self.app.route(['/record/<wb_url:path>', '/anonymous/record/<wb_url:path>'], method='ANY')
        def redir_anon_rec(wb_url):
            wb_url = self.add_query(wb_url)
            new_url = '/anonymous/{rec}/record/{url}'.format(rec=self.DEF_REC_NAME,
                                                             url=wb_url)
            return self.redirect(new_url)

        @self.app.route('/replay/<wb_url:path>', method='ANY')
        def redir_anon_replay(wb_url):
            wb_url = self.add_query(wb_url)
            new_url = '/anonymous/{url}'.format(url=wb_url)
            return self.redirect(new_url)

        # LIVE DEBUG
        @self.app.route('/live/<wb_url:path>', method='ANY')
        def live(wb_url):
            request.path_shift(1)

            return self.handle_anon_content(wb_url, rec='', type='live')

        # ANON ROUTES
        @self.app.route('/anonymous/<rec>/record/<wb_url:path>', method='ANY')
        def anon_record(rec, wb_url):
            request.path_shift(3)

            return self.handle_anon_content(wb_url, rec, type='record')

        @self.app.route('/anonymous/<rec>/patch/<wb_url:path>', method='ANY')
        def anon_patch(rec, wb_url):
            request.path_shift(3)

            return self.handle_anon_content(wb_url, rec, type='patch')

        @self.app.route('/anonymous/<wb_url:re:[^$].*>', method='ANY')
        def anon_replay(wb_url):
            rec_name = '*'

            # recording replay
            if not self.WB_URL_RX.match(wb_url) and '/' in wb_url:
                rec_name, wb_url = wb_url.split('/', 1)

                # todo: edge case: something like /anonymous/example.com/
                # should check if 'example.com' is a recording, otherwise assume url?
                #if not wb_url:
                #    wb_url = rec_name
                #    rec_name = '*'

            if rec_name == '*':
                request.path_shift(1)
                type_ = 'replay-coll'

            else:
                request.path_shift(2)
                type_ = 'replay'

            return self.handle_anon_content(wb_url, rec=rec_name, type=type_)

        # ANON DOWNLOAD
        @self.app.get('/anonymous/<rec>/$download')
        def anon_download_rec_warc(rec):
            user = self.get_anon_user()
            coll = 'anonymous'

            return self.handle_download('rec', user, coll, rec)

        @self.app.get('/anonymous/$download')
        def anon_download_coll_warc():
            user = self.get_anon_user()
            coll = 'anonymous'

            return self.handle_download('coll', user, coll, '*')

        # special case match: /anonymous/rec/example.com -- don't treat as user/coll/rec
        @self.app.route('/anonymous/<rec>/<host:re:[^$][^/]+>')
        def anon_replay_host_only(rec, host):
            request.path_shift(2)
            return self.handle_anon_content(host, rec, type='replay')

        # LOGGED IN ROUTES
        @self.app.route('/<user>/<coll>/<rec>/record/<wb_url:path>', method='ANY')
        def logged_in_record(user, coll, rec, wb_url):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='record')

        @self.app.route('/<user>/<coll>/<wb_url:re:[^$].*>', method='ANY')
        def logged_in_replay(user, coll, wb_url):
            rec_name = '*'

            # recording replay
            if not self.WB_URL_RX.match(wb_url) and '/' in wb_url:
                rec_name, wb_url = wb_url.split('/', 1)

                # todo: edge case: something like /anonymous/example.com/
                # should check if 'example.com' is a recording, otherwise assume url?
                #if not wb_url:
                #    wb_url = rec_name
                #    rec_name = '*'

            if rec_name == '*':
                request.path_shift(2)
                type_ = 'replay-coll'

            else:
                request.path_shift(3)
                type_ = 'replay'

            return self.handle_routing(wb_url, user, coll, rec=rec_name, type=type_)

        # Logged-In Download
        @self.app.get('/<user>/<coll>/<rec>/$download')
        def logged_in_download_rec_warc(user, coll, rec):

            return self.handle_download('rec', user, coll, rec)

        @self.app.get('/<user>/<coll>/$download')
        def logged_in_download_coll_warc(user, coll):
            return self.handle_download('coll', user, coll, '*')

    def handle_download(self, type, user, coll, rec):
        info = {}

        if rec == '*':
            info = self.manager.get_collection(user, coll)
            if not info:
                self._raise_error(404, 'Collection not found',
                                  id=coll)

            title = info.get('title', coll)

        else:
            info = self.manager.get_recording(user, coll, rec)
            if not info:
                self._raise_error(404, 'Collection not found',
                                  id=coll)

            title = info.get('title', rec)

        now = timestamp_now()
        filename = self.PATHS['download_filename'].format(title=title,
                                                          timestamp=now)

        download_url = self.PATHS['download']
        download_url = download_url.format(record_host=self.record_host,
                                           user=user,
                                           coll=coll,
                                           rec=rec,
                                           type=type,
                                           filename=filename)

        res = requests.get(download_url, stream=True)

        if res.status_code >= 400:  #pragma: no cover
            try:
                res.raw.close()
            except:
                pass

            self._raise_error(400, 'Unable to download WARC')

        response.headers['Content-Type'] = 'application/octet-stream'
        response.headers['Content-Disposition'] = 'attachment; filename=' + quote(filename)

        length = res.headers.get('Content-Length')
        if length:
            response.headers['Content-Length'] = length

        encoding = res.headers.get('Transfer-Encoding')
        if encoding:
            response.headers['Transfer-Encoding'] = encoding

        return StreamIter(res.raw)

    def get_anon_user(self, save_sesh=True):
        user = self.manager.get_anon_user(save_sesh)
        return user

    def handle_anon_content(self, wb_url, rec, type):
        save_sesh = (type in ('record', 'patch'))
        user = self.get_anon_user(save_sesh)
        coll = 'anonymous'

        return self.handle_routing(wb_url, user, coll, rec, type)

    def handle_routing(self, wb_url, user, coll, rec, type):
        wb_url = self.add_query(wb_url)
        if type in ('record', 'patch', 'replay'):
            if not self.manager.has_recording(user, coll, rec):
                if coll != 'anonymous' and not self.manager.has_collection(user, coll):
                    self._redir_if_sanitized(self.sanitize_title(coll),
                                             coll,
                                             wb_url)
                    raise HTTPError(404, 'No Such Collection')

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
    def get_upstream_url(self, url, wb_url, closest, kwargs):
        type = kwargs['type']
        if url != '{url}':
            url = quote(url)

        upstream_url = self.PATHS[type].format(url=url,
                                               closest=closest,
                                               record_host=self.record_host,
                                               replay_host=self.replay_host,
                                               **kwargs)

        return upstream_url

    def process_query_cdx(self, cdx, wb_url, kwargs):
        rec = kwargs.get('rec')
        print(rec, cdx['source'])
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
                'rec': kwargs['rec']
               }

    def _add_custom_params(self, cdx, resp_headers, kwargs):
        #type = kwargs['type']
        #if type in ('live', 'record'):
        #    cdx['is_live'] = 'true'

        if resp_headers.get('Webagg-Source-Coll') == 'live':
            cdx['is_live'] = 'true'

    def handle_custom_response(self, environ, wb_url, full_prefix, host_prefix, kwargs):
        @self.jinja2_view('browser_embed.html')
        def browser_embed(browser):
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

