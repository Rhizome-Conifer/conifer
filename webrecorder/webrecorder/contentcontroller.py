import os
import re
import base64
import requests
import json

from six.moves.urllib.parse import quote

from bottle import Bottle, request, redirect, HTTPError, response

from pywb.utils.timeutils import timestamp_now

from urlrewrite.rewriterapp import RewriterApp

from webrecorder.basecontroller import BaseController

from webagg.utils import StreamIter
from io import BytesIO


# ============================================================================
class ContentController(BaseController, RewriterApp):
    DEF_REC_NAME = 'my-recording'

    PATHS = {'live': '{replay_host}/live/resource/postreq?url={url}&closest={closest}',
             'record': '{record_host}/record/live/resource/postreq?url={url}&closest={closest}&param.user={user}&param.coll={coll}&param.rec={rec}',
             'replay': '{replay_host}/replay/resource/postreq?url={url}&closest={closest}&param.replay.user={user}&param.replay.coll={coll}&param.replay.rec={rec}',
             'replay-coll': '{replay_host}/replay-coll/resource/postreq?url={url}&closest={closest}&param.user={user}&param.coll={coll}',

             'download': '{record_host}/download?user={user}&coll={coll}&rec={rec}&filename={filename}&type={type}',
             'download_filename': '{title}-{timestamp}.warc.gz'
            }

    WB_URL_RX = re.compile('((\d*)([a-z]+_)?/)?(https?:)?//.*')

    def __init__(self, app, jinja_env, manager, config):
        self.record_host = os.environ['RECORD_HOST']
        self.replay_host = os.environ['WEBAGG_HOST']

        BaseController.__init__(self, app, jinja_env, manager, config)
        RewriterApp.__init__(self, framed_replay=True, jinja_env=jinja_env)

    def init_routes(self):
        # REDIRECTS
        @self.app.route(['/record/<wb_url:path>', '/anonymous/record/<wb_url:path>'], method='ANY')
        def redir_anon_rec(wb_url):
            wb_url = self.add_query(wb_url)
            new_url = '/anonymous/{rec}/record/{url}'.format(rec=self.DEF_REC_NAME,
                                                             url=wb_url)
            return redirect(new_url)

        @self.app.route('/replay/<wb_url:path>', method='ANY')
        def redir_anon_replay(wb_url):
            wb_url = self.add_query(wb_url)
            new_url = '/anonymous/{url}'.format(url=wb_url)
            return redirect(new_url)

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

        @self.app.route('/anonymous/<wb_url:path>', method='ANY')
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
        @self.app.route('/anonymous/<rec>/<host>')
        def anon_replay_host_only(rec, host):
            request.path_shift(2)
            return self.handle_anon_content(host, rec, type='replay')



        # USER?COLL ROUTES
        @self.app.route('/<user>/<coll>/<rec>/record/<wb_url:path>', method='ANY')
        def usercoll_record(user, coll, rec, wb_url):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='record')

        @self.app.route('/<user>/<coll>/<wb_url:path>', method='ANY')
        def usercoll_replay(user, coll, wb_url):
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

        # USERCOLL Download
        @self.app.get('/<user>/<coll>/<rec>/$download')
        def usercoll_download_rec_warc(rec):

            return self.handle_download('rec', user, coll, rec)

        @self.app.get('/<user>/<coll>/$download')
        def usercoll_download_coll_warc(user, coll):
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

    def get_anon_user(self):
        sesh = request.environ['webrec.session']
        user = sesh.anon_user.replace('@anon-', 'anon/')
        return user

    def handle_anon_content(self, wb_url, rec, type):
        wb_url = self.add_query(wb_url)
        sesh = request.environ['webrec.session']
        user = self.get_anon_user()
        coll = 'anonymous'

        if type == 'record' and not sesh.is_anon():
            sesh.set_anon()

        return self.handle_routing(wb_url, user, coll, rec, type)

    def handle_routing(self, wb_url, user, coll, rec, type):
        if type == 'record' or type == 'replay':
            if not self.manager.has_recording(user, coll, rec):
                title = rec
                rec = self.sanitize_title(title)

                if type == 'record':
                    if rec == title or not self.manager.has_recording(user, coll, rec):
                        result = self.manager.create_recording(user, coll, rec, title)

                if rec != title:
                    target = self.get_host()
                    target += request.script_name.replace(title, rec)
                    target += wb_url
                    redirect(target)

                if type == 'replay':
                    raise HTTPError(404, 'No Such Recording')

        return self.render_content(wb_url, user=user,
                                           coll=coll,
                                           rec=rec,
                                           type=type)


    def add_query(self, url):
        if request.query_string:
            url += '?' + request.query_string

        return url

    def get_top_frame_params(self, wb_url, kwargs):
        type = kwargs['type']
        if type == 'live':
            return {}

        #request.environ['webrec.template_params']['curr_mode'] = type
        info = self.manager.get_content_inject_info(kwargs['user'],
                                                    kwargs['coll'],
                                                    kwargs['rec'])

        username = kwargs['user']
        if self.manager.is_anon(username):
            username = 'anonymous'

        return {'info': info, 'curr_mode': type,
                'username': username,
                'coll': kwargs['coll'],
                'rec': kwargs['rec']
               }

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

    def _add_custom_params(self, cdx, resp_headers, kwargs):
        #type = kwargs['type']
        #if type in ('live', 'record'):
        #    cdx['is_live'] = 'true'

        if resp_headers.get('Webagg-Source-Coll') == 'live':
            cdx['is_live'] = 'true'


    def handle_custom_response(self, wb_url, full_prefix, host_prefix, kwargs):
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

        return RewriterApp.handle_custom_response(self, wb_url, full_prefix, host_prefix, kwargs)

