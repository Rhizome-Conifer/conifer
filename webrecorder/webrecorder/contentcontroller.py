import re
import os
import json

from six.moves.urllib.parse import quote, unquote, urlencode

from bottle import Bottle, request, HTTPError, response, HTTPResponse, redirect
import requests

from pywb.utils.loaders import load_yaml_config
from pywb.rewrite.wburl import WbUrl
from pywb.rewrite.cookies import CookieTracker

from pywb.apps.rewriterapp import RewriterApp, UpstreamException

from webrecorder.basecontroller import BaseController, wr_api_spec
from webrecorder.load.wamloader import WAMLoader
from webrecorder.utils import get_bool

from webrecorder.models.dynstats import DynStats
from webrecorder.models.stats import Stats


# ============================================================================
class ContentController(BaseController, RewriterApp):
    DEF_REC_NAME = 'Recording Session'

    WB_URL_RX = re.compile('(([\d*]*)([a-z]+_|[$][a-z0-9:.-]+)?/)?([a-zA-Z]+:)?//.*')

    MODIFY_MODES = ('record', 'patch', 'extract')

    def __init__(self, *args, **kwargs):
        BaseController.__init__(self, *args, **kwargs)

        config = kwargs['config']

        self.content_error_redirect = os.environ.get('CONTENT_ERROR_REDIRECT')

        config['csp-header'] = self.get_csp_header()

        self.browser_mgr = kwargs['browser_mgr']

        RewriterApp.__init__(self,
                             framed_replay=True,
                             jinja_env=kwargs['jinja_env'],
                             config=config)

        self.paths = config['url_templates']

        self.cookie_tracker = CookieTracker(self.redis)

        self.record_host = os.environ['RECORD_HOST']
        self.live_host = os.environ['WARCSERVER_HOST']
        self.replay_host = os.environ.get('WARCSERVER_PROXY_HOST')
        if not self.replay_host:
            self.replay_host = self.live_host
        self.session_redirect_host = os.environ.get('SESSION_REDIRECT_HOST')

        self.wam_loader = WAMLoader()
        self._init_client_archive_info()

        self.dyn_stats = DynStats(self.redis, config)

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

    def get_csp_header(self):
        csp = "default-src 'unsafe-eval' 'unsafe-inline' 'self' data: blob: mediastream: ws: wss: "
        if self.app_host and self.content_host != self.app_host:
            csp += self.app_host + '/_set_session'

        if self.content_error_redirect:
            csp += ' ' + self.content_error_redirect

        csp += "; form-action 'self'"
        return csp

    def init_routes(self):
        wr_api_spec.set_curr_tag('External Archives')

        @self.app.get('/api/v1/client_archives')
        def get_client_archives():
            return self.client_archives

        wr_api_spec.set_curr_tag('Browsers')

        @self.app.get('/api/v1/create_remote_browser')
        def create_browser():
            """ Api to launch remote browser instances
            """
            sesh = self.get_session()

            if sesh.is_new() and self.is_content_request():
                self._raise_error(403, 'invalid_browser_request')

            browser_id = request.query['browser']

            Stats(self.redis).incr_browser(browser_id)

            user = self.get_user(redir_check=False)

            data = request.query

            coll_name = data.getunicode('coll', '')
            rec = data.get('rec', '')

            mode = data.get('mode', '')

            url = data.getunicode('url', '')
            timestamp = data.get('timestamp', '')

            sources = ''
            inv_sources = ''
            patch_rec = ''

            collection = user.get_collection_by_name(coll_name)
            recording = collection.get_recording(rec)

            if not collection:
                self._raise_error(404, 'no_such_collection')

            if mode == 'extract':
                # Extract from All, Patch from None
                sources = '*'
                inv_sources = '*'
            elif mode.startswith('extract:'):
                # Extract from One, Patch from all but one
                sources = mode.split(':', 1)[1]
                inv_sources = sources
                # load patch recording also
                #patch_recording = collection.get_recording(recording['patch_rec'])
                if recording:
                    patch_rec = recording.get_prop('patch_rec')

                mode = 'extract'
            elif mode.startswith('extract_only:'):
                # Extract from one only, no patching
                sources = mode.split(':', 1)[1]
                inv_sources = '*'
                mode = 'extract'

            if mode in self.MODIFY_MODES:
                if not recording:
                    return self._raise_error(404, 'no_such_recording')

                #rec = recording.my_id
            elif mode in ('replay', 'replay-coll'):
                rec = '*'
            else:
                return self._raise_error(400, 'invalid_mode')


            browser_can_write = '1' if self.access.can_write_coll(collection) else '0'

            remote_ip = self._get_remote_ip()

            # build kwargs
            kwargs = dict(user=user.name,
                          id=sesh.get_id(),
                          coll=collection.my_id,
                          rec=rec,
                          coll_name=quote(coll_name),
                          #rec_name=quote(rec_name, safe='/*'),

                          type=mode,
                          sources=sources,
                          inv_sources=inv_sources,
                          patch_rec=patch_rec,

                          remote_ip=remote_ip,
                          ip=remote_ip,

                          browser=browser_id,
                          url=url,
                          request_ts=timestamp,

                          browser_can_write=browser_can_write)

            data = self.browser_mgr.request_new_browser(kwargs)

            if 'error_message' in data:
                self._raise_error(400, data['error_message'])

            return data

        # UPDATE REMOTE BROWSER CONFIG
        @self.app.get('/api/v1/update_remote_browser/<reqid>')
        def update_remote_browser(reqid):
            user, collection = self.load_user_coll(api=True)

            timestamp = request.query.getunicode('timestamp')
            type_ = request.query.getunicode('type')

            # if switching mode, need to have write access
            # for timestamp, only read access
            if type_:
                self.access.assert_can_write_coll(collection)
            else:
                self.access.assert_can_read_coll(collection)

            return self.browser_mgr.update_remote_browser(reqid,
                                                          type_=type_,
                                                          timestamp=timestamp)

        # REDIRECTS
        @self.app.route('/record/<wb_url:path>', method='ANY')
        def redir_new_temp_rec(wb_url):
            coll_name = 'temp'
            rec_title = self.DEF_REC_NAME
            wb_url = self.add_query(wb_url)
            return self.do_create_new_and_redir(coll_name, rec_title, wb_url, 'record')

        @self.app.route('/$record/<coll_name>/<rec_title>/<wb_url:path>', method='ANY')
        def redir_new_record(coll_name, rec_title, wb_url):
            wb_url = self.add_query(wb_url)
            return self.do_create_new_and_redir(coll_name, rec_title, wb_url, 'record')

        # API NEW
        wr_api_spec.set_curr_tag('Recordings')

        @self.app.post('/api/v1/new')
        def api_create_new():
            self.redir_host()

            url = request.json.get('url')
            coll = request.json.get('coll')
            mode = request.json.get('mode')

            desc = request.json.get('desc', '')

            browser = request.json.get('browser')
            is_content = request.json.get('is_content') and not browser
            timestamp = request.json.get('timestamp')

            wb_url = self.construct_wburl(url, timestamp, browser, is_content)

            host = self.content_host if is_content else self.app_host
            if not host:
                host = request.urlparts.netloc

            full_url = request.environ['wsgi.url_scheme'] + '://' + host

            url, rec, patch_rec = self.do_create_new(coll, '', wb_url, mode, desc=desc)

            full_url += url

            return {'url': full_url,
                    'user': self.access.session_user.name,
                    'rec_name': rec,
                    'patch_rec_name': patch_rec
                   }

        # COOKIES
        wr_api_spec.set_curr_tag('Cookies')

        @self.app.post('/api/v1/auth/cookie')
        def add_cookie():
            user, collection = self.load_user_coll()

            data = request.json or {}

            rec_name = data.get('rec', '*')
            recording = collection.get_recording(rec_name)

            name = data.get('name')
            value = data.get('value')
            domain = data.get('domain')

            if not domain:
                return self._raise_error(400, 'domain_missing')

            self.add_cookie(user, collection, recording, name, value, domain)

            return {'success': domain}

        # PROXY
        @self.app.route('/_proxy/<url:path>', method='ANY')
        def do_proxy(url):
            return self.do_proxy(url)

        # PROXY with CORS
        @self.app.route('/proxy-fetch/<url:path>', method='GET')
        def do_proxy_fetch_cors(url):
            res = self.do_proxy(url)

            if 'HTTP_ORIGIN' in request.environ:
                self.set_options_headers(None, None, res)

            return res

        @self.app.route('/api/v1/remote/put-record', method='PUT')
        def do_put_record():
            return self.do_put_record()

        # LIVE DEBUG
        #@self.app.route('/live/<wb_url:path>', method='ANY')
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
        @self.app.route('/<user>/<coll>/<rec>/record/<wb_url:path>', method='ANY')
        def do_record(user, coll, rec, wb_url):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='record', redir_route='record')

        # Patch
        @self.app.route('/<user>/<coll>/<rec>/patch/<wb_url:path>', method='ANY')
        def do_patch(user, coll, rec, wb_url):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='patch', redir_route='patch')

        # Extract
        @self.app.route('/<user>/<coll>/<rec>/extract\:<archive>/<wb_url:path>', method='ANY')
        def do_extract_patch_archive(user, coll, rec, wb_url, archive):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='extract',
                                       sources=archive,
                                       inv_sources=archive,
                                       redir_route='extract:' + archive)

        @self.app.route('/<user>/<coll>/<rec>/extract_only\:<archive>/<wb_url:path>', method='ANY')
        def do_extract_only_archive(user, coll, rec, wb_url, archive):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='extract',
                                       sources=archive,
                                       inv_sources='*',
                                       redir_route='extract_only:' + archive)

        @self.app.route('/<user>/<coll>/<rec>/extract/<wb_url:path>', method='ANY')
        def do_extract_all(user, coll, rec, wb_url):
            request.path_shift(4)

            return self.handle_routing(wb_url, user, coll, rec, type='extract',
                                       sources='*',
                                       inv_sources='*',
                                       redir_route='extract')

        # REPLAY
        # Replay List
        @self.app.route('/<user>/<coll>/list/<list_id>/<bk_id>/<wb_url:path>', method='ANY')
        def do_replay_rec(user, coll, list_id, bk_id, wb_url):
            request.path_shift(5)

            return self.handle_routing(wb_url, user, coll, '*', type='replay-coll')

        # Replay Recording
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
        @self.app.get(['/_set_session'])
        def set_sesh():
            sesh = self.get_session()

            if self.is_content_request():
                cookie = request.query.getunicode('cookie')
                sesh.set_id_from_cookie(cookie)
                return self.redirect(request.query.getunicode('path'))

            else:
                url = request.environ['wsgi.url_scheme'] + '://' + self.content_host
                self.set_options_headers(self.content_host, self.app_host)
                response.headers['Cache-Control'] = 'no-cache'

                cookie = request.query.getunicode('webrec.sesh_cookie')

                # otherwise, check if content cookie provided
                # already have same session, just redirect back
                # likely a real 404 not found
                if sesh.is_same_session(request.query.getunicode('content_cookie')):
                    redirect(url + request.query.getunicode('path'))

                # if anon, ensure session is persisted before setting content session
                # generate cookie to pass
                if not cookie:
                    self.access.init_session_user(persist=True)
                    cookie = sesh.get_cookie()

                cookie = quote(cookie)
                url += '/_set_session?{0}&cookie={1}'.format(request.environ['QUERY_STRING'], cookie)
                redirect(url)

        # OPTIONS
        @self.app.route('/_set_session', method='OPTIONS')
        def set_sesh_options():
            self.set_options_headers(self.content_host, self.app_host)
            return ''

        @self.app.route('/_clear_session', method='OPTIONS')
        def set_clear_options():
            self.set_options_headers(self.app_host, self.content_host)
            return ''

        # CLEAR CONTENT SESSION
        @self.app.get(['/_clear_session'])
        def clear_sesh():
            self.set_options_headers(self.app_host, self.content_host)
            response.headers['Cache-Control'] = 'no-cache'

            if not self.is_content_request():
                self._raise_error(400, 'invalid_request')

            try:
                # delete session (will updated cookie)
                self.get_session().delete()
                return {'success': 'logged_out'}

            except Exception as e:
                self._raise_error(400, 'invalid_request')

    def do_proxy(self, url):
        info = self.browser_mgr.init_remote_browser_session()
        if not info:
            return self._raise_error(400, 'invalid_connection_source')

        try:
            kwargs = info
            user = info['the_user']
            collection = info['collection']
            recording = info['recording']

            if kwargs['type'] == 'replay-coll':
                collection.sync_coll_index(exists=False,  do_async=False)

            url = self.add_query(url)

            kwargs['url'] = url
            wb_url = kwargs.get('request_ts', '') + 'bn_/' + url

            request.environ['webrec.template_params'] = kwargs

            remote_ip = info.get('remote_ip')

            if remote_ip and info['type'] in self.MODIFY_MODES:
                remote_ip = self.check_rate_limit(user, remote_ip)
                kwargs['ip'] = remote_ip

            resp = self.render_content(wb_url, kwargs, request.environ)

            resp = HTTPResponse(body=resp.body,
                                status=resp.status_headers.statusline,
                                headers=resp.status_headers.headers)

            return resp

        except Exception as e:
            import traceback
            traceback.print_exc()

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

    def do_put_record(self):
        reqid = request.query.getunicode('reqid')
        info = self.browser_mgr.init_remote_browser_session(reqid=reqid)
        if not info:
            return self._raise_error(400, 'invalid_connection_source')

        user = info['the_user']
        collection = info['collection']
        recording = info['recording']

        kwargs = dict(user=user.name,
                      coll=collection.my_id,
                      rec=recording.my_id,
                      type='put_record')

        url = request.query.getunicode('target_uri')

        params = {'url': url}

        upstream_url = self.get_upstream_url('', kwargs, params)

        headers = {'Content-Type': request.environ.get('CONTENT_TYPE', 'text/plain')}

        r = requests.put(upstream_url,
                         data=request.body,
                         headers=headers,
                        )
        try:
            res = r.json()
            if res['success'] != 'true':
                print(res)
                return {'error_message': 'put_record_failed'}

            warc_date = res.get('WARC-Date')

        except Exception as e:
            print(e)
            return {'error_message': 'put_record_failed'}

        return res

    def do_create_new_and_redir(self, coll_name, rec_name, wb_url, mode):
        new_url, _, _2 = self.do_create_new(coll_name, rec_name, wb_url, mode)
        return self.redirect(new_url)

    def do_create_new(self, coll_name, rec_title, wb_url, mode, desc=''):
        if mode == 'record':
            result = self.check_remote_archive(wb_url, mode)
            if result:
                mode, wb_url = result

        user = self.access.init_session_user()

        if user.is_anon():
            if self.anon_disabled:
                self.flash_message('Sorry, anonymous recording is not available.')
                self.redirect('/')
                return

            coll_name = 'temp'
            coll_title = 'Temporary Collection'

        else:
            coll_title = coll_name
            coll_name = self.sanitize_title(coll_title)

        collection = user.get_collection_by_name(coll_name)
        if not collection:
            collection = user.create_collection(coll_name, title=coll_title)

        recording = self._create_new_rec(collection, rec_title, mode, desc=desc)

        if mode.startswith('extract:'):
            patch_recording = self._create_new_rec(collection,
                                                   self.patch_of_name(recording['title']),
                                                   'patch')

            recording.set_patch_recording(patch_recording)

            patch_rec_name = patch_recording.my_id
        else:
            patch_rec_name = ''

        new_url = '/{user}/{coll}/{rec}/{mode}/{url}'.format(user=user.my_id,
                                                             coll=collection.name,
                                                             rec=recording.name,
                                                             mode=mode,
                                                             url=wb_url)
        return new_url, recording.my_id, patch_rec_name

    def redir_set_session(self):
        full_path = request.environ['SCRIPT_NAME'] + request.environ['PATH_INFO']
        full_path = self.add_query(full_path)
        self.redir_host(self.session_redirect_host, '/_set_session?path=' + quote(full_path))

    def _create_new_rec(self, collection, title, mode, desc=''):
        #rec_name = self.sanitize_title(title) if title else ''
        rec_type = 'patch' if mode == 'patch' else None
        return collection.create_recording(title=title,
                                           desc=desc,
                                           rec_type=rec_type)

    def patch_of_name(self, name):
        return 'Patch of ' + name

    def handle_routing(self, wb_url, user, coll_name, rec_name, type,
                       is_embed=False,
                       is_display=False,
                       sources='',
                       inv_sources='',
                       redir_route=None):

        wb_url = self._full_url(wb_url)
        if user == '_new' and redir_route:
            return self.do_create_new_and_redir(coll_name, rec_name, wb_url, redir_route)

        sesh = self.get_session()

        remote_ip = None
        frontend_cache_header = None
        patch_recording = None

        the_user, collection, recording = self.user_manager.get_user_coll_rec(user, coll_name, rec_name)

        if not the_user:
            msg = 'not_found' if user == 'api' else 'no_such_user'
            self._raise_error(404, msg)

        coll = collection.my_id if collection else None
        rec = recording.my_id if recording else None

        if type in self.MODIFY_MODES:
            if sesh.is_new() and self.is_content_request():
                self.redir_set_session()

            if not recording:
                self._redir_if_sanitized(self.sanitize_title(rec_name),
                                         rec_name,
                                         wb_url)

                # don't auto create recording for inner frame w/o accessing outer frame
                self._raise_error(404, 'no_such_recording')

            elif not recording.is_open():
                # force creation of new recording as this one is closed
                self._raise_error(400, 'recording_not_open')

            collection.access.assert_can_write_coll(collection)

            if the_user.is_out_of_space():
                self._raise_error(402, 'out_of_space')

            remote_ip = self._get_remote_ip()

            remote_ip = self.check_rate_limit(the_user, remote_ip)

            if inv_sources and inv_sources != '*':
                #patch_rec_name = self.patch_of_name(rec, True)
                patch_recording = recording.get_patch_recording()
                #patch_recording = collection.get_recording_by_name(patch_rec_name)

        if type in ('replay-coll', 'replay'):
            if not collection:
                self._redir_if_sanitized(self.sanitize_title(coll_name),
                                         coll_name,
                                         wb_url)

                if sesh.is_new() and self.is_content_request():
                    self.redir_set_session()
                else:
                    self._raise_error(404, 'no_such_collection')

            access = self.access.check_read_access_public(collection)

            if not access:
                if sesh.is_new() and self.is_content_request():
                    self.redir_set_session()
                else:
                    self._raise_error(404, 'no_such_collection')

            if access != 'public':
                frontend_cache_header = ('Cache-Control', 'private')

            if type == 'replay':
                if not recording:
                    self._raise_error(404, 'no_such_recording')

        request.environ['SCRIPT_NAME'] = quote(request.environ['SCRIPT_NAME'], safe='/:')

        wb_url = self._context_massage(wb_url)

        wb_url_obj = WbUrl(wb_url)

        is_top_frame = (wb_url_obj.mod == self.frame_mod or wb_url_obj.mod.startswith('$br:'))

        if type == 'record' and is_top_frame:
            result = self.check_remote_archive(wb_url, type, wb_url_obj)
            if result:
                mode, wb_url = result
                new_url = '/{user}/{coll}/{rec}/{mode}/{url}'.format(user=user,
                                                                     coll=coll_name,
                                                                     rec=rec_name,
                                                                     mode=mode,
                                                                     url=wb_url)
                return self.redirect(new_url)

        elif type == 'replay-coll' and not is_top_frame:
            collection.sync_coll_index(exists=False, do_async=False)

        kwargs = dict(user=user,
                      id=sesh.get_id(),
                      coll=coll,
                      rec=rec,
                      coll_name=quote(coll_name),
                      rec_name=quote(rec_name, safe='/*'),

                      the_user=the_user,
                      collection=collection,
                      recording=recording,
                      patch_recording=patch_recording,

                      type=type,
                      sources=sources,
                      inv_sources=inv_sources,
                      patch_rec=patch_recording.my_id if patch_recording else None,
                      ip=remote_ip,
                      is_embed=is_embed,
                      is_display=is_display)

        # top-frame replay but through a proxy, redirect to original
        if is_top_frame and 'wsgiprox.proxy_host' in request.environ:
            kwargs['url'] = wb_url_obj.url
            kwargs['request_ts'] = wb_url_obj.timestamp
            self.browser_mgr.update_local_browser(kwargs)
            return redirect(wb_url_obj.url)

        try:
            self.check_if_content(wb_url_obj, request.environ, is_top_frame)

            resp = self.render_content(wb_url, kwargs, request.environ)

            if frontend_cache_header:
                resp.status_headers.headers.append(frontend_cache_header)

            resp = HTTPResponse(body=resp.body,
                                status=resp.status_headers.statusline,
                                headers=resp.status_headers.headers)

            return resp

        except UpstreamException as ue:
            err_context = {
                'url': ue.url,
                'status': ue.status_code,
                'error': ue.msg.get('error'),
                'timestamp': wb_url_obj.timestamp if wb_url_obj else '',
                'user': user,
                'coll': coll_name,
                'rec': rec_name,
                'type': type,
                'app_host': self.app_host,
            }

            @self.jinja2_view('content_error.html')
            def handle_error(error):
                response.status = ue.status_code
                return error

            if self.content_error_redirect:
                return redirect(self.content_error_redirect + '?' + urlencode(err_context), code=307)
            else:
                return handle_error(err_context)

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

    def _full_url(self, url=''):
        request_uri = request.environ.get('REQUEST_URI')
        script_name = request.environ.get('SCRIPT_NAME', '') + '/'
        if request_uri and script_name and request_uri.startswith(script_name):
            url = request_uri[len(script_name):]
        else:
            if not url:
                url = environ.request.environ['SCRIPT_NAME'] + environ.request.environ['PATH_INFO']

            url = self.add_query(url)

        return url

    def get_cookie_key(self, kwargs):
        sesh_id = self.get_session().get_id()
        return self.dyn_stats.get_cookie_key(kwargs['the_user'],
                                             kwargs['collection'],
                                             kwargs['recording'],
                                             sesh_id=sesh_id)

    def add_cookie(self, user, collection, recording, name, value, domain):
        sesh_id = self.get_session().get_id()
        key = self.dyn_stats.get_cookie_key(user,
                                            collection,
                                            recording,
                                            sesh_id=sesh_id)

        self.cookie_tracker.add_cookie(key, domain, name, value)

    def _get_remote_ip(self):
        remote_ip = request.environ.get('HTTP_X_REAL_IP')
        remote_ip = remote_ip or request.environ.get('REMOTE_ADDR', '')
        remote_ip = remote_ip.rsplit('.', 1)[0]
        return remote_ip

    def check_rate_limit(self, user, remote_ip):
        # check rate limit and return ip used for further limiting
        # if skipping limit, return empty string to avoid incrementing
        # rate counter for this request
        res = user.is_rate_limited(remote_ip)
        if res == True:
            self._raise_error(402, 'rate_limit_exceeded')
        # if None, then no rate limit at all, return empty string
        elif res == None:
            return ''

        else:
            return remote_ip

    ## RewriterApp overrides
    def get_base_url(self, wb_url, kwargs):
        # for proxy mode, 'upstream_url' already provided
        # just use that
        #base_url = kwargs.get('upstream_url')
        #if base_url:
        #    base_url = base_url.format(**kwargs)
        #    return base_url

        type = kwargs['type']

        base_url = self.paths[type].format(record_host=self.record_host,
                                           replay_host=self.replay_host,
                                           live_host=self.live_host,
                                           **kwargs)

        return base_url

    def process_query_cdx(self, cdx, wb_url, kwargs):
        rec = kwargs.get('rec')
        if not rec or rec == '*':
            rec = cdx['source'].split(':', 1)[0]

        cdx['rec'] = rec

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

        info = self.get_content_inject_info(kwargs['the_user'],
                                            kwargs['collection'],
                                            kwargs['recording'])

        return {'info': info,
                'curr_mode': type,

                'user': kwargs['user'],

                'coll': kwargs['coll'],
                'coll_name': kwargs['coll_name'],
                'coll_title': info.get('coll_title', ''),

                'rec': kwargs['rec'],
                'rec_name': kwargs['rec_name'],
                'rec_title': info.get('rec_title', ''),

                'is_embed': kwargs.get('is_embed'),
                'is_display': kwargs.get('is_display'),

                'top_prefix': top_prefix,

                'sources': kwargs.get('sources'),
                'inv_sources': kwargs.get('inv_sources'),
               }

    def _add_custom_params(self, cdx, resp_headers, kwargs, record):
        try:
            self._add_stats(cdx, resp_headers, kwargs, record)
        except:
            import traceback
            traceback.print_exc()

    def _add_stats(self, cdx, resp_headers, kwargs, record):
        type_ = kwargs['type']

        if type_ == 'replay-coll':
            content_len = record.rec_headers.get_header('Content-Length')
            if content_len is not None:
                Stats(self.redis).incr_replay(int(content_len), kwargs['user'])

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
        ra_recording = None

        # set source in recording-key
        if type_ in self.MODIFY_MODES:
            skip = resp_headers.get('Recorder-Skip')

            if not skip and source not in ('live', 'replay'):
                ra_rec = unquote(resp_headers.get('Recorder-Rec', ''))
                ra_rec = ra_rec or kwargs['rec']

                recording = kwargs.get('recording')
                patch_recording = kwargs.get('patch_recording')

                if recording and ra_rec == recording.my_id:
                    ra_recording = recording
                elif patch_recording and ra_rec == patch_recording.my_id:
                    ra_recording = patch_recording

        url = cdx.get('url')
        referrer = request.environ.get('HTTP_REFERER')

        if not referrer:
            referrer = url
        elif ('wsgiprox.proxy_host' not in request.environ and
            request.environ.get('HTTP_HOST') in referrer):
            referrer = url

        self.dyn_stats.update_dyn_stats(url, kwargs, referrer, source, ra_recording)

    def handle_custom_response(self, environ, wb_url, full_prefix, host_prefix, kwargs):
        # test if request specifies a containerized browser
        if wb_url.mod.startswith('$br:'):
            return self.handle_browser_embed(wb_url, kwargs)

        return RewriterApp.handle_custom_response(self, environ, wb_url, full_prefix, host_prefix, kwargs)

    def handle_browser_embed(self, wb_url, kwargs):
        #handle cbrowsers
        browser_id = wb_url.mod.split(':', 1)[1]

        kwargs['browser_can_write'] = '1' if self.access.can_write_coll(kwargs['collection']) else '0'

        kwargs['remote_ip'] = self._get_remote_ip()

        kwargs['url'] = wb_url.url
        kwargs['timestamp'] = wb_url.timestamp
        kwargs['browser'] = browser_id

        # container redis info
        inject_data = self.browser_mgr.request_new_browser(kwargs)
        if 'error_message' in inject_data:
            self._raise_error(400, inject_data['error_message'])

        inject_data.update(self.get_top_frame_params(wb_url, kwargs))
        inject_data['wb_url'] = wb_url

        @self.jinja2_view('browser_embed.html')
        def browser_embed(data):
            return data

        return browser_embed(inject_data)

    def get_content_inject_info(self, user, collection, recording):
        info = {}

        # recording
        if recording:
            info['rec_id'] = recording.my_id
            #info['rec_title'] = quote(recording.get_title(), safe='/ ')
            info['size'] = recording.size

        else:
            info['size'] = collection.size

        # collection
        info['coll_id'] = collection.name
        info['coll_title'] = quote(collection.get_prop('title', collection.name), safe='/ ')

        info['coll_desc'] = quote(collection.get_prop('desc', ''))

        info['size_remaining'] = user.get_size_remaining()

        return info

    def construct_wburl(self, url, ts, browser, is_content):
        prefix = ts or ''

        if browser:
            prefix += '$br:' + browser
        elif is_content:
            prefix += 'mp_'

        if prefix:
            return prefix + '/' + url
        else:
            return url



