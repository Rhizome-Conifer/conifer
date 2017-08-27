import re
import os
from six.moves.urllib.parse import quote, unquote

from bottle import Bottle, request, HTTPError, response, HTTPResponse, redirect

from pywb.utils.loaders import load_yaml_config
from pywb.rewrite.wburl import WbUrl
from pywb.rewrite.cookies import CookieTracker

from pywb.apps.rewriterapp import RewriterApp, UpstreamException

from webrecorder.basecontroller import BaseController
from webrecorder.load.wamloader import WAMLoader


# ============================================================================
class ContentController(BaseController, RewriterApp):
    DEF_REC_NAME = 'Recording Session'

    WB_URL_RX = re.compile('(([\d*]*)([a-z]+_|[$][a-z0-9:.-]+)?/)?([a-zA-Z]+:)?//.*')

    MODIFY_MODES = ('record', 'patch', 'extract')

    def __init__(self, app, jinja_env, config, redis):
        BaseController.__init__(self, app, jinja_env, None, config)
        RewriterApp.__init__(self,
                             framed_replay=True,
                             jinja_env=jinja_env,
                             config=config)

        self.paths = config['url_templates']

        self.cookie_key_templ = config['cookie_key_templ']

        self.cookie_tracker = CookieTracker(redis)

        self.record_host = os.environ['RECORD_HOST']
        self.live_host = os.environ['WEBAGG_HOST']
        self.replay_host = os.environ.get('WEBAGG_PROXY_HOST')
        if not self.replay_host:
            self.replay_host = self.live_host

        self.wam_loader = WAMLoader()
        self._init_client_archive_info()
        self.init_csp_header()

    def _init_client_archive_info(self):
        self.client_archives = {}
        for pk, archive in self.wam_loader.replay_info.items():
            info = {'name': archive['name'],
                    'about': archive['about'],
                    'prefix': archive['replay_prefix'],
                   }
            if archive.get('parse_collection'):
                info['parse_collection'] = True

            self.client_archives[pk] = info

    def init_csp_header(self):
        csp = "default-src 'unsafe-eval' 'unsafe-inline' 'self' data: blob: mediastream: "
        if self.content_host != self.app_host:
            csp += self.app_host + '/_set_session'

        csp += "; form-action 'self'"
        self.csp_header = ('Content-Security-Policy', csp)

    def add_csp_header(self, wb_url, status_headers):
        status_headers.headers.append(self.csp_header)

    def init_routes(self):
        # REDIRECTS
        @self.app.route('/record/<wb_url:path>', method='ANY')
        def redir_new_temp_rec(wb_url):
            coll = 'temp'
            rec = self.DEF_REC_NAME
            wb_url = self.add_query(wb_url)
            return self.do_create_new_and_redir(coll, rec, wb_url, 'record')

        @self.app.route('/$record/<coll>/<rec>/<wb_url:path>', method='ANY')
        def redir_new_record(coll, rec, wb_url):
            wb_url = self.add_query(wb_url)
            return self.do_create_new_and_redir(coll, rec, wb_url, 'record')

        # TAGS
        @self.app.get(['/_tags/', '/_tags/<tags:re:([\w,-]+)>'])
        @self.jinja2_view('paging_display.html')
        def tag_display(tags=None):
            if not self.manager.is_beta():
                raise HTTPError(404)

            tags = tags.split(',') if tags else self.manager.get_available_tags()
            items = {}
            keys = []

            active_tags = self.manager.get_available_tags()

            for tag in tags:
                if tag in active_tags:
                    keys.append(tag)
                    items[tag] = self.manager.get_pages_for_tag(tag)

            return {'data': items, 'keys': keys}

        # COLLECTIONS
        @self.app.get(['/_display/<user>', '/_display/<user>/<collections:re:([\w,-]+)>'])
        @self.jinja2_view('paging_display.html')
        def collection_display(user, collections=None):
            if not self.manager.is_beta():
                raise HTTPError(404)

            user_collections = [c['id'] for c in self.manager.get_collections(user)]
            colls = collections.split(',') if collections else user_collections
            items = {}
            keys = []

            for coll in colls:
                if coll in user_collections:
                    keys.append(coll)
                    items[coll] = self.manager.list_coll_pages(user, coll)

            return {'data': items, 'keys': keys}

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

            if not domain:
                return {'error_message': 'no domain'}

            self.add_cookie(user, coll, rec, name, value, domain)

            return {'success': domain}

        # PROXY
        @self.app.route('/_proxy/<url:path>', method='ANY')
        def do_proxy(url):
            return self.do_proxy(url)

        # LIVE DEBUG
        @self.app.route('/live/<wb_url:path>', method='ANY')
        def live(wb_url):
            request.path_shift(1)

            return self.handle_routing(wb_url, user='$live', coll='temp', rec='', type='live')

        # EMDED
        @self.app.route('/_embed/<user>/<coll>/<wb_url:path>', method='ANY')
        def embed_replay(user, coll, wb_url):
            request.path_shift(3)
            #return self.do_replay_coll_or_rec(user, coll, wb_url, is_embed=True)
            return self.handle_routing(wb_url, user, coll, '*', type='replay-coll',
                                       is_embed=True)


        # DISPLAY
        @self.app.route('/_embed_noborder/<user>/<coll>/<wb_url:path>', method='ANY')
        def embed_replay(user, coll, wb_url):
            request.path_shift(3)
            #return self.do_replay_coll_or_rec(user, coll, wb_url, is_embed=True,
            #                                  is_display=True)
            return self.handle_routing(wb_url, user, coll, '*', type='replay-coll',
                                       is_embed=True, is_display=True)


        # CONTENT ROUTES
        # Record
        @self.app.route('/<user>/<coll>/<rec:path>/record/<wb_url:path>', method='ANY')
        def do_record(user, coll, rec, wb_url):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='record', redir_route='record')

        # Patch
        @self.app.route('/<user>/<coll>/<rec>/patch/<wb_url:path>', method='ANY')
        def do_patch(user, coll, rec, wb_url):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='patch', redir_route='patch')

        # Extract
        @self.app.route('/<user>/<coll>/<rec:path>/extract\:<archive>/<wb_url:path>', method='ANY')
        def do_extract_patch_archive(user, coll, rec, wb_url, archive):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='extract',
                                       sources=archive,
                                       inv_sources=archive,
                                       redir_route='extract:' + archive)

        @self.app.route('/<user>/<coll>/<rec:path>/extract_only\:<archive>/<wb_url:path>', method='ANY')
        def do_extract_only_archive(user, coll, rec, wb_url, archive):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='extract',
                                       sources=archive,
                                       inv_sources='*',
                                       redir_route='extract_only:' + archive)

        @self.app.route('/<user>/<coll>/<rec:path>/extract/<wb_url:path>', method='ANY')
        def do_extract_all(user, coll, rec, wb_url):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='extract',
                                       sources='*',
                                       inv_sources='*',
                                       redir_route='extract')

        # Replay
        @self.app.route('/<user>/<coll>/<rec>/replay/<wb_url:path>', method='ANY')
        def do_replay_rec(user, coll, rec, wb_url):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='replay')

        # Replay Coll
        @self.app.route('/<user>/<coll>/<wb_url:path>', method='ANY')
        def do_replay_coll(user, coll, wb_url):
            request.path_shift(2)

            return self.handle_routing(wb_url, user, coll, '*', type='replay-coll')

        # Session redir
        @self.app.route(['/_set_session'])
        def set_sesh():
            sesh = self.get_session()

            if self.is_content_request():
                id = request.query.getunicode('id')
                sesh.set_id(id)
                return self.redirect(request.query.getunicode('path'))

            else:
                url = request.environ['wsgi.url_scheme'] + '://' + self.content_host
                response.headers['Access-Control-Allow-Origin'] = url
                response.headers['Cache-Control'] = 'no-cache'

                redirect(url + '/_set_session?' + request.environ['QUERY_STRING'] + '&id=' + quote(sesh.get_id()))

        @self.app.route(['/_clear_session'])
        def clear_sesh():
            sesh = self.get_session()
            sesh.delete()
            return self.redir_host(None, request.query.getunicode('path', '/'))

    def do_proxy(self, url):
        info = self.manager.browser_mgr.init_cont_browser_sesh()
        if not info:
            return {'error_message': 'conn not from valid containerized browser'}

        try:
            kwargs = info
            kwargs['coll_orig'] = kwargs['coll']
            kwargs['coll'] = quote(kwargs['coll'])
            kwargs['rec_orig'] = kwargs['rec']
            kwargs['rec'] = quote(kwargs['rec'], '/*')

            url = self.add_query(url)

            kwargs['url'] = url
            wb_url = kwargs.get('request_ts', '') + 'bn_/' + url

            request.environ['webrec.template_params'] = kwargs

            remote_ip = info.get('remote_ip')

            if remote_ip and info['type'] in self.MODIFY_MODES:
                if self.manager.is_rate_limited(info['user'], remote_ip):
                    raise HTTPError(402, 'Rate Limit')

            resp = self.render_content(wb_url, kwargs, request.environ)

            resp = HTTPResponse(body=resp.body,
                                status=resp.status_headers.statusline,
                                headers=resp.status_headers.headers)

            return resp

        except Exception as e:
            @self.jinja2_view('content_error.html')
            def handle_error(status_code, err_body, environ):
                response.status = status_code
                kwargs['url'] = url
                kwargs['status'] = status_code
                kwargs['err_body'] = err_body
                kwargs['host_prefix'] = self.get_host_prefix(environ)
                kwargs['proxy_magic'] = environ.get('wsgiprox.proxy_host', '')
                return kwargs

            status_code = 500
            if hasattr(e, 'status_code'):
                status_code = e.status_code

            if hasattr(e, 'body'):
                err_body = e.body
            elif hasattr(e, 'msg'):
                err_body = e.msg
            else:
                err_body = ''

            return handle_error(status_code, err_body, request.environ)

    def check_remote_archive(self, wb_url, mode, wb_url_obj=None):
        wb_url_obj = wb_url_obj or WbUrl(wb_url)

        res = self.wam_loader.find_archive_for_url(wb_url_obj.url)
        if not res:
            return

        pk, new_url, id_ = res

        mode = 'extract:' + id_

        new_url = WbUrl(new_url).to_str(mod=wb_url_obj.mod)

        return mode, new_url

    def do_create_new_and_redir(self, coll, rec, wb_url, mode):
        if mode == 'record':
            result = self.check_remote_archive(wb_url, mode)
            if result:
                mode, wb_url = result

        rec_title = rec

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

        rec = self._create_new_rec(user, coll, rec_title, mode)

        if mode.startswith('extract:'):
            patch_rec = self._create_new_rec(user, coll,
                                             self.patch_of_name(rec_title),
                                             'patch')

        new_url = '/{user}/{coll}/{rec}/{mode}/{url}'.format(user=user,
                                                             coll=coll,
                                                             rec=rec,
                                                             mode=mode,
                                                             url=wb_url)
        return self.redirect(new_url)

    def is_content_request(self):
        if not self.content_host:
            return False

        return request.environ.get('HTTP_HOST') == self.content_host

    def redir_set_session(self):
        full_path = request.environ['SCRIPT_NAME'] + request.environ['PATH_INFO']
        full_path = self.add_query(full_path)
        self.redir_host(None, '/_set_session?path=' + quote(full_path))

    def _create_new_rec(self, user, coll, title, mode, no_dupe=False):
        rec = self.sanitize_title(title)
        rec_type = 'patch' if mode == 'patch' else None
        result = self.manager.create_recording(user, coll, rec, title,
                                               rec_type=rec_type,
                                               no_dupe=no_dupe)
        rec = result['id']
        return rec

    def patch_of_name(self, name, is_id=False):
        if not is_id:
            return 'Patch of ' + name
        else:
            return 'patch-of-' + name

    def handle_routing(self, wb_url, user, coll, rec, type,
                       is_embed=False,
                       is_display=False,
                       sources='',
                       inv_sources='',
                       redir_route=None):

        wb_url = self.add_query(wb_url)
        if user == '_new' and redir_route:
            return self.do_create_new_and_redir(coll, rec, wb_url, redir_route)

        not_found = False
        no_dupe = True

        sesh = self.get_session()

        if sesh.is_new() and self.is_content_request():
            self.redir_set_session()

        remote_ip = None
        frontend_cache_header = None

        if type in self.MODIFY_MODES:
            if not self.manager.has_recording(user, coll, rec):
                not_found = True
            elif not self.manager.is_recording_open(user, coll, rec):
                # force creation of new recording as this one is closed
                not_found = True
                no_dupe = False

            self.manager.assert_can_write(user, coll)

            if self.manager.is_out_of_space(user):
                raise HTTPError(402, 'Out of Space')

            remote_ip = self._get_remote_ip()

            if self.manager.is_rate_limited(user, remote_ip):
                raise HTTPError(402, 'Rate Limit')

        if type == 'replay-coll':
            res = self.manager.has_collection_is_public(user, coll)
            not_found = not res
            if not_found:
                self._redir_if_sanitized(self.sanitize_title(coll),
                                         coll,
                                         wb_url)

                raise HTTPError(404, 'No Such Collection')

            if res != 'public':
                frontend_cache_header = ('Cache-Control', 'private')

        elif type == 'replay':
            if not self.manager.has_recording(user, coll, rec):
                not_found = True

        patch_rec = ''

        if not_found:
            title = rec

            if type in self.MODIFY_MODES:
                rec = self._create_new_rec(user, coll, title, type, no_dupe=no_dupe)

            # create patch recording as well
            if inv_sources and inv_sources != '*':
                patch_rec = self._create_new_rec(user, coll, self.patch_of_name(title),
                                                 mode='patch',
                                                 no_dupe=no_dupe)

            self._redir_if_sanitized(rec, title, wb_url)

            if type == 'replay':
                raise HTTPError(404, 'No Such Recording')

        elif inv_sources and inv_sources != '*':
            patch_rec = self.patch_of_name(rec, True)

        request.environ['SCRIPT_NAME'] = quote(request.environ['SCRIPT_NAME'], safe='/:')

        wb_url = self._context_massage(wb_url)

        wb_url_obj = WbUrl(wb_url)
        is_top_frame = (wb_url_obj.mod == self.frame_mod or wb_url_obj.mod.startswith('$br:'))

        if type == 'record' and is_top_frame:
            result = self.check_remote_archive(wb_url, type, wb_url_obj)
            if result:
                mode, wb_url = result
                new_url = '/{user}/{coll}/{rec}/{mode}/{url}'.format(user=user,
                                                                     coll=coll,
                                                                     rec=rec,
                                                                     mode=mode,
                                                                     url=wb_url)
                return self.redirect(new_url)

        elif type == 'replay-coll' :
            self.manager.cache_coll_replay(user, coll, exists=False,
                                           do_async=is_top_frame)

        kwargs = dict(user=user,
                      coll_orig=coll,
                      id=sesh.get_id(),
                      rec_orig=rec,
                      coll=quote(coll),
                      rec=quote(rec, safe='/*'),
                      type=type,
                      sources=sources,
                      inv_sources=inv_sources,
                      patch_rec=patch_rec,
                      ip=remote_ip,
                      is_embed=is_embed,
                      is_display=is_display,
                      use_js_obj_proxy=True)

        try:
            self.check_if_content(wb_url_obj, request.environ, is_top_frame)

            resp = self.render_content(wb_url, kwargs, request.environ)

            if not is_top_frame:
                self.add_csp_header(wb_url_obj, resp.status_headers)

            if frontend_cache_header:
                resp.status_headers.headers.append(frontend_cache_header)

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
                        'type': type,
                        'app_host': self.app_host,
                       }

            return handle_error(ue.status_code, type, ue.url, ue.msg)

    def check_if_content(self, wb_url, environ, is_top_frame):
        if not wb_url.is_replay():
            return

        if not self.content_host:
            return

        if is_top_frame:
            if self.is_content_request():
                self.redir_host(self.app_host)
        else:
            if not self.is_content_request():
                self.redir_host(self.content_host)

    def _filter_headers(self, type, status_headers):
        if type in ('replay', 'replay-coll'):
            new_headers = []
            for name, value in status_headers.headers:
                if name.lower() != 'set-cookie':
                    new_headers.append((name, value))

            status_headers.headers = new_headers

    def _inject_nocache_headers(self, status_headers, kwargs):
        if 'browser_id' in kwargs:
            status_headers.headers.append(
                ('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate')
            )

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

    def get_cookie_key(self, kwargs):
        sesh = self.get_session()
        id = sesh.get_id()
        kwargs['id'] = id
        if kwargs.get('rec') == '*':
            kwargs['rec'] = '<all>'

        return self.cookie_key_templ.format(**kwargs)

    def add_cookie(self, user, coll, rec, name, value, domain):
        key = self.get_cookie_key(dict(user=user,
                                       coll=coll,
                                       rec=rec))

        self.cookie_tracker.add_cookie(key, domain, name, value)

    def _get_remote_ip(self):
        remote_ip = request.environ.get('HTTP_X_REAL_IP')
        remote_ip = remote_ip or request.environ.get('REMOTE_ADDR', '')
        return remote_ip

    ## RewriterApp overrides
    def get_base_url(self, wb_url, kwargs):
        # for proxy mode, 'upstream_url' already provided
        # just use that
        base_url = kwargs.get('upstream_url')
        if base_url:
            base_url = base_url.format(**kwargs)
            return base_url

        type = kwargs['type']

        base_url = self.paths[type].format(record_host=self.record_host,
                                           replay_host=self.replay_host,
                                           live_host=self.live_host,
                                           **kwargs)

        return base_url

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
        if self.content_host and 'wsgiprox.proxy_host' not in environ:
            return environ['wsgi.url_scheme'] + '://' + self.content_host
        else:
            return super(ContentController, self).get_host_prefix(environ)

    def get_top_url(self, full_prefix, wb_url, cdx, kwargs):
        if wb_url.mod != self.frame_mod and self.content_host != self.app_host:
            full_prefix = full_prefix.replace(self.content_host, self.app_host)

        return super(ContentController, self).get_top_url(full_prefix, wb_url, cdx, kwargs)

    def get_top_frame_params(self, wb_url, kwargs):
        type = kwargs['type']

        top_prefix = super(ContentController, self).get_host_prefix(request.environ)
        top_prefix += self.get_rel_prefix(request.environ)

        if type == 'live':
            return {'curr_mode': type,
                    'is_embed': kwargs.get('is_embed'),
                    'is_display': kwargs.get('is_display'),
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
                'is_display': kwargs.get('is_display'),
                'top_prefix': top_prefix,
                'sources': kwargs.get('sources'),
                'inv_sources': kwargs.get('inv_sources'),
               }

    def _add_custom_params(self, cdx, resp_headers, kwargs):
        try:
            self._add_stats(cdx, resp_headers, kwargs)
        except:
            import traceback
            traceback.print_exc()

    def _add_stats(self, cdx, resp_headers, kwargs):
        type_ = kwargs['type']
        if type_ in ('record', 'live'):
            return

        source = cdx.get('source')
        if not source:
            return

        if source == 'local':
            source = 'replay'

        if source == 'replay' and type_ == 'patch':
            return

        orig_source = cdx.get('orig_source_id')
        if orig_source:
            source = orig_source

        ra_rec = None

        # set source in recording-key
        if type_ in self.MODIFY_MODES:
            skip = resp_headers.get('Recorder-Skip')

            if not skip and source not in ('live', 'replay'):
                ra_rec = unquote(resp_headers.get('Recorder-Rec', ''))
                ra_rec = ra_rec or kwargs['rec_orig']

        url = cdx.get('url')
        referrer = request.environ.get('HTTP_REFERER')

        if not referrer:
            referrer = url
        elif ('wsgiprox.proxy_host' not in request.environ and
            request.environ.get('HTTP_HOST') in referrer):
            referrer = url

        self.manager.update_dyn_stats(url, kwargs, referrer, source, ra_rec)

    def handle_custom_response(self, environ, wb_url, full_prefix, host_prefix, kwargs):
        # test if request specifies a containerized browser
        if wb_url.mod.startswith('$br:'):
            return self.handle_browser_embed(wb_url, kwargs)

        return RewriterApp.handle_custom_response(self, environ, wb_url, full_prefix, host_prefix, kwargs)

    def handle_browser_embed(self, wb_url, kwargs):
        #handle cbrowsers
        browser_id = wb_url.mod.split(':', 1)[1]

        kwargs['browser_can_write'] = '1' if self.manager.can_write_coll(kwargs['user'], kwargs['coll']) else '0'

        kwargs['remote_ip'] = self._get_remote_ip()

        # container redis info
        inject_data = self.manager.browser_mgr.request_new_browser(browser_id, wb_url, kwargs)
        if 'error_message' in inject_data:
            self._raise_error(400, inject_data['error_message'])

        inject_data.update(self.get_top_frame_params(wb_url, kwargs))

        @self.jinja2_view('browser_embed.html')
        def browser_embed(data):
            return data

        return browser_embed(inject_data)

