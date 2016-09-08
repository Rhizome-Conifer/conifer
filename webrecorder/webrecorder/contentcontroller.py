import os
import re
import base64
import requests
import json

from bottle import Bottle, request, HTTPError, response, HTTPResponse, redirect

from urlrewrite.rewriterapp import RewriterApp, UpstreamException
from urlrewrite.cookies import CookieTracker

from pywb.utils.timeutils import timestamp_now, iso_date_to_timestamp
from pywb.utils.timeutils import timestamp_to_datetime, datetime_to_iso_date
from pywb.rewrite.wburl import WbUrl

from webrecorder.basecontroller import BaseController
from webrecorder.unrewriter import HTMLDomUnRewriter, UnRewriter

from six.moves.urllib.parse import quote
from io import BytesIO


# ============================================================================
class ContentController(BaseController, RewriterApp):
    DEF_REC_NAME = 'Recording Session'

    WB_URL_RX = re.compile('(([\d*]*)([a-z]+_)?/)?([a-zA-Z]+:)?//.*')

    def __init__(self, app, jinja_env, manager, config):
        BaseController.__init__(self, app, jinja_env, manager, config)
        RewriterApp.__init__(self,
                             framed_replay=True,
                             jinja_env=jinja_env,
                             config=config)

        self.paths = config['url_templates']
        self.cookie_key_templ = config['cookie_key_templ']

        self.cookie_tracker = CookieTracker(manager.redis)

        self.content_host = os.environ['CONTENT_HOST']

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

        @self.app.route('/$record/<coll>/<rec>/<wb_url:path>', method='ANY')
        def redir_record_always(coll, rec, wb_url):
            rec_title = rec
            rec = self.sanitize_title(rec_title)

            user = self.manager.get_curr_user()

            if not user:
                user = self.manager.get_anon_user(True)
                coll = 'temp'
                coll_title = 'Temporary Collection'

            else:
                coll_title = coll
                coll = self.sanitize_title(coll_title)

            if not self.manager.has_collection(user, coll):
                self.manager.create_collection(user, coll, coll_title)

            recording = self.manager.create_recording(user, coll, rec, rec_title)

            rec = recording['id']
            new_url = '/{user}/{coll}/{rec}/record/{url}'.format(user=user,
                                                                 coll=coll,
                                                                 rec=rec,
                                                                 url=wb_url)
            return self.redirect(new_url)

        # COOKIES
        @self.app.get(['/<user>/<coll>/$add_cookie'], method='POST')
        def add_cookie(user, coll):
            if not self.manager.has_collection(user, coll):
                self._raise_error(404, 'Collection not found',
                                  api=True, id=coll)

            rec = request.query.getunicode('rec', '*')

            name = request.forms.getunicode('name')
            value = request.forms.getunicode('value')
            domain = request.forms.getunicode('domain')

            key = self.get_cookie_key(dict(user=user,
                                           coll=coll,
                                           rec=rec))

            if not domain:
                return {'error_message': 'no domain'}

            self.cookie_tracker.add_cookie(key, domain, name, value)
            return {'success': domain}

        # LIVE DEBUG
        @self.app.route('/live/<wb_url:path>', method='ANY')
        def live(wb_url):
            request.path_shift(1)

            return self.handle_routing(wb_url, user='$live', coll='temp', rec='', type='live')

        # EMDED
        @self.app.route('/_embed/<user>/<coll>/<wb_url:path>', method='ANY')
        def embed_replay(user, coll, wb_url):
            request.path_shift(1)
            return self.do_replay_coll_or_rec(user, coll, wb_url, is_embed=True)

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
            return self.do_replay_coll_or_rec(user, coll, wb_url)

        @self.app.route('/_snapshot', method='PUT')
        def snapshot():
            return self.snapshot()

        @self.app.route(['/_set_session'])
        def set_sesh():
            sesh = self.get_session()

            if self.is_content_request():
                id = request.query.get('id')
                sesh.set_id(id)
                return self.redirect(request.query.get('path'))

            else:
                url = request.environ['wsgi.url_scheme'] + '://' + self.content_host
                response.headers['Access-Control-Allow-Origin'] = url
                response.headers['Cache-Control'] = 'no-cache'

                redirect(url + '/_set_session?' + request.environ['QUERY_STRING'] + '&id=' + quote(sesh.get_id()))

    def do_replay_coll_or_rec(self, user, coll, wb_url, is_embed=False):
        rec_name = '*'

        # recording replay
        if not self.WB_URL_RX.match(wb_url) and '/' in wb_url:
            rec_name, wb_url = wb_url.split('/', 1)

        if rec_name == '*':
            request.path_shift(2)
            type_ = 'replay-coll'

        else:
            try:
                request.path_shift(3)
            except:
                self._raise_error(404, 'Empty Recording')

            type_ = 'replay'

        return self.handle_routing(wb_url, user, coll,
                                   rec=rec_name,
                                   type=type_,
                                   is_embed=is_embed)

    def is_content_request(self):
        if not self.content_host:
            return False

        return request.environ.get('HTTP_HOST') == self.content_host

    def handle_routing(self, wb_url, user, coll, rec, type, is_embed=False):
        wb_url = self.add_query(wb_url)

        not_found = False

        sesh = self.get_session()

        if sesh.is_new() and self.is_content_request():
            full_path = request.environ['SCRIPT_NAME'] + request.environ['PATH_INFO']
            self.redir_host(None, '/_set_session?path=' + quote(full_path))

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

        return self.handle_load_content(wb_url, user, coll, rec, type, is_embed)

    def handle_load_content(self, wb_url, user, coll, rec, type, is_embed=False):
        request.environ['SCRIPT_NAME'] = quote(request.environ['SCRIPT_NAME'])

        wb_url = self._context_massage(wb_url)

        kwargs = dict(user=user,
                      coll_orig=coll,
                      rec_orig=rec,
                      coll=quote(coll),
                      rec=quote(rec, safe='/*'),
                      type=type,
                      is_embed=is_embed)

        try:
            self.check_if_content(wb_url, request.environ)

            resp = self.render_content(wb_url, kwargs, request.environ)

            #self._filter_headers(type, resp.status_headers)

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

    def check_if_content(self, wb_url, environ):
        wb_url = WbUrl(wb_url)
        if (wb_url.is_replay()):
            environ['is_content'] = True

            if self.content_host and not self.is_content_request() and wb_url.mod != self.frame_mod:
                self.redir_host(self.content_host)

    def _filter_headers(self, type, status_headers):
        if type in ('replay', 'replay-coll'):
            new_headers = []
            for name, value in status_headers.headers:
                if name.lower() != 'set-cookie':
                    new_headers.append((name, value))

            status_headers.headers = new_headers

    def _redir_if_sanitized(self, id, title, wb_url):
        if id != title:
            target = request.script_name.replace(title, id)
            target += wb_url
            self.redirect(target)

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
        id = self.get_session().get_id()
        kwargs['id'] = id
        if kwargs.get('rec') == '*':
            kwargs['rec'] = '<all>'

        return self.cookie_key_templ.format(**kwargs)

    def process_query_cdx(self, cdx, wb_url, kwargs):
        rec = kwargs.get('rec')
        if not rec or rec == '*':
            rec = cdx['source'].rsplit(':', 2)[-2]

        cdx['rec'] = rec

    def get_query_params(self, wb_url, kwargs):
        collection = self.manager.get_collection(kwargs['user'], kwargs['coll_orig'])
        kwargs['rec_titles'] = dict((rec['id'], rec['title']) for rec in collection['recordings'])

        kwargs['user'] = self.get_view_user(kwargs['user'])
        kwargs['coll_title'] = collection.get('title', '')
        return kwargs

    def get_host_prefix(self, environ):
        if self.content_host and environ.get('is_content'):
            return environ['wsgi.url_scheme'] + '://' + self.content_host
        else:
            return super(ContentController, self).get_host_prefix(environ)

    def get_top_url(self, full_prefix, wb_url, cdx, kwargs):
        if wb_url.mod != self.frame_mod and self.content_host != self.app_host:
            full_prefix = full_prefix.replace(self.content_host, self.app_host)
            return super(ContentController, self).get_top_url(full_prefix, wb_url, cdx, kwargs)

        top_url = full_prefix
        top_url += wb_url.to_str()
        print('TOP URL', top_url)
        return top_url

    def get_top_frame_params(self, wb_url, kwargs):
        type = kwargs['type']

        top_prefix = super(ContentController, self).get_host_prefix(request.environ)
        top_prefix += self.get_rel_prefix(request.environ)

        if type == 'live':
            return {'curr_mode': type,
                    'is_embed': kwargs.get('is_embed'),
                    'top_prefix': top_prefix}

        # refresh cookie expiration,
        # disable until can guarantee cookie is not changed!
        #self.get_session().update_expires()

        info = self.manager.get_content_inject_info(kwargs['user'],
                                                    kwargs['coll_orig'],
                                                    kwargs['rec_orig'])

        return {'info': info,
                'curr_mode': type,
                'user': self.get_view_user(kwargs['user']),
                'coll': kwargs['coll'],
                'coll_orig': kwargs['coll_orig'],
                'rec': kwargs['rec'],
                'rec_orig': kwargs['rec_orig'],
                'coll_title': info.get('coll_title', ''),
                'rec_title': info.get('rec_title', ''),
                'is_embed': kwargs.get('is_embed'),
                'top_prefix': top_prefix,
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
            upstream_url = self.get_upstream_url(wb_url, kwargs, {})

            upstream_url += '&url={url}'

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

    def snapshot(self):
        user, coll = self.get_user_coll(api=True)
        #rec = request.query.getunicode('rec')

        #if rec and rec != '*':
        #    recording = self.manager.get_recording(user, coll, rec)
        #    if not recording:
        #        return {'error_message' 'recording not found'}

        #    snap_title = recording['title'] + ' Snapshots'
        #else:
        if not self.manager.has_collection(user, coll):
            return {'error_message' 'collection not found'}

        snap_title = 'Static Snapshots'

        snap_rec = self.sanitize_title(snap_title)

        if not self.manager.has_recording(user, coll, snap_rec):
            recording = self.manager.create_recording(user, coll, snap_rec, snap_title)

        kwargs = dict(user=user,
                      coll=quote(coll),
                      rec=quote(snap_rec, safe='/*'),
                      type='snapshot')

        html_text = request.body.read().decode('utf-8')

        host = request.urlparts.scheme + '://' + request.urlparts.netloc
        prefix = request.query.getunicode('prefix')

        html_text = HTMLDomUnRewriter.unrewrite_html(host, prefix, html_text)

        url = request.query.getunicode('url')

        params = {'url': url}

        upstream_url = self.get_upstream_url('', kwargs, params)

        referrer = request.environ.get('HTTP_REFERER', '')
        referrer = UnRewriter(host, prefix).rewrite(referrer)

        timedate = datetime_to_iso_date(timestamp_to_datetime(request.query.getunicode('top_ts')))

        headers = {'Content-Type': 'text/html; charset=utf-8',
                   'WARC-User-Agent': request.environ.get('HTTP_USER_AGENT'),
                   'WARC-Referer': referrer,
                   #'WARC-Refers-To-Target-URI': request.query.getunicode('top_url'),
                   #'WARC-Refers-To-Date': timedate,
                  }

        r = requests.put(upstream_url,
                         data=BytesIO(html_text.encode('utf-8')),
                         headers=headers,
                        )

        try:
            res = r.json()
            if res['success'] != 'true':
                print(res)
                return {'error_message': 'Snapshot Failed'}

            warc_date = res.get('WARC-Date')

        except Exception as e:
            print(e)
            return {'error_message': 'Snapshot Failed'}


        title = request.query.getunicode('title')

        if title:
            if warc_date:
                timestamp = iso_date_to_timestamp(warc_date)
            else:
                timestamp = timestamp_now()


            page_data = {'url': url,
                         'title': title,
                         'timestamp': timestamp,
                         'tags': ['snapshot'],
                        }

            res = self.manager.add_page(user, coll, snap_rec, page_data)

            return {'snapshot': page_data}
        else:
            return {'snapshot': ''}


