from pywb.cdx.cdxsource import CDXFile, RedisCDXSource
from pywb.cdx.cdxserver import CDXServer

from pywb.framework.archivalrouter import Route

from pywb.webapp.pywb_init import DirectoryCollsLoader
from pywb.webapp.handlers import WBHandler
from pywb.webapp.live_rewrite_handler import RewriteHandler, LiveResourceException
from pywb.webapp.views import J2TemplateView
from pywb.webapp.replay_views import CaptureException, ReplayView

from pywb.warc.recordloader import ArcWarcRecordLoader
from pywb.warc.resolvingloader import ResolvingLoader
from pywb.warc.pathresolvers import PathResolverMapper

from pywb.framework.wbrequestresponse import WbResponse
from pywb.utils.wbexception import NotFoundException
from pywb.rewrite.url_rewriter import UrlRewriter

import os
import re
import json
import base64
from os.path import expandvars


#=================================================================
class DynamicRoute(Route):
    def apply_filters(self, wbrequest, matcher):
        wbrequest.custom_params['output_dir'] = wbrequest.env.get('w_output_dir', '')
        wbrequest.custom_params['sesh_id'] = wbrequest.env.get('w_sesh_id', '')
        wbrequest.custom_params['user_id'] = wbrequest.env.get('w_user_id', '')
        wbrequest.coll = wbrequest.env.get('w_path', '')


#=================================================================
class DynCDXServer(CDXServer):
    def _create_cdx_sources(self, paths, config):
        paths = expandvars(paths)
        if paths.startswith('redis://'):
            src = DynCDXRedis(paths)
        else:
            src = DynCDXFile(paths)

        self.sources = [src]


#=================================================================
class DynCDXRedis(RedisCDXSource):
    def load_cdx(self, query):
        path = query.params['output_dir']
        if not path:
            print('No Path')
            return iter([])

        sesh_id = query.params['sesh_id']
        cdx_key = sesh_id.replace('/', ':') + ':cdxj'
        cdx_key = cdx_key.encode('utf-8')

        return self.load_sorted_range(query, cdx_key)


#=================================================================
class DynCDXFile(CDXFile):
    """
    Represents a parametric cdx file
    """
    def __init__(self, filename):
        self.root_path = ''
        self.param_file = filename

    def load_cdx(self, query):
        path = query.params['output_dir']

        if not path:
            print('No Path')
            return iter([])

        filename = os.path.join(self.root_path,
                                path,
                                self.param_file)

        return self._do_load_file(filename, query)

    def __str__(self):
        return 'Dyn CDX File - ' + self.root_path


#=================================================================
class DynRedisResolver(object):
    def __init__(self, redis, remote_target=None, proxy_target=None, key_prefix='w:'):
        self.redis = redis
        self.remote_target = remote_target
        self.proxy_target = proxy_target
        self.key_prefix = key_prefix

    def __call__(self, filename, cdx):
        sesh_id, warc_key = self._split_sesh_warc(filename)

        warc_key = warc_key.encode('utf-8')
        sesh_id = sesh_id.encode('utf-8')

        orig_path = self.redis.hget(sesh_id, warc_key)

        if not orig_path:
            return []

        orig_path = orig_path.decode('utf-8')

        # if proxy_path set, try proxy path first
        if self.remote_target and self.proxy_target:
            cached_path = orig_path.replace(self.remote_target, self.proxy_target)
            return [cached_path, orig_path]
        else:
            return [orig_path]

    def add_filename(self, filename, remote_url):
        sesh_id, warc_key = self._split_sesh_warc(filename)

        warc_key = warc_key.encode('utf-8')
        sesh_id = sesh_id.encode('utf-8')
        remote_url = remote_url.encode('utf-8')

        redis_val = self.redis.hset(sesh_id, warc_key, remote_url)

    def _split_sesh_warc(self, filename):
        #TODO: pass sesh_id here...
        parts = filename.rsplit('/')
        #return 'warc:' + parts[-5] + ':' + parts[-3], parts[-1]
        return parts[-5] + ':' + parts[-3] + ':warc', parts[-1]

    def __repr__(self):
        return "DynRedisResolver('{0}')".format(self.redis)


#=================================================================
# Fix for old snapshots that did not have a DOCTYPE html
# if snapshot, ensure that DOCTYPE html is added
class WebRecReplayView(ReplayView):
    def replay_capture(self, wbrequest, cdx, cdx_loader, failed_files):
        metadata = cdx.get('metadata')
        if metadata and 'snapshot' in metadata:
            decl = '<!DOCTYPE html>'
        else:
            decl = None

        wbrequest.urlrewriter.rewrite_opts['force_html_decl'] = decl

        return (super(WebRecReplayView, self).
                replay_capture(wbrequest, cdx, cdx_loader, failed_files))


#=================================================================
class DynWBHandler(WBHandler):
    def _init_replay_view(self, config):
        cookie_maker = config.get('cookie_maker')
        record_loader = ArcWarcRecordLoader(cookie_maker=cookie_maker)

        paths = config.get('archive_paths')

        resolving_loader = ResolvingLoader(PathResolverMapper()(paths),
                                           record_loader=record_loader)

        redis_warc_resolver = config.get('redis_warc_resolver')
        if redis_warc_resolver:
            resolving_loader.path_resolvers.append(redis_warc_resolver)

        return WebRecReplayView(resolving_loader, config)

    def get_top_frame_params(self, wbrequest, mod):
        params = (super(DynWBHandler, self).
                  get_top_frame_params(wbrequest, mod))

        manager = wbrequest.env.get('w_manager')

        if manager:
            user, coll = wbrequest.custom_params['sesh_id'].split('/', 1)
            info = manager.get_info(user, coll)
            params['info'] = json.dumps(info)

        return params

    def handle_replay(self, wbrequest, cdx_lines):
        path = wbrequest.custom_params['output_dir']
        #path = os.path.join(path, 'archive')

        try:
            cdx_callback = self.index_reader.cdx_load_callback(wbrequest)

            def wrapped_cdx_callback(*args, **kwargs):
                return self._wrap_session_path(path, cdx_callback(*args, **kwargs))

            wrapped_cdx_lines = self._wrap_session_path(path, cdx_lines)

            return self.replay.render_content(wbrequest,
                                              wrapped_cdx_lines,
                                              wrapped_cdx_callback)
        except CaptureException:
            if (self.fallback_handler and
                not wbrequest.wb_url.is_query() and
                not wbrequest.wb_url.is_identity):
                return self.fallback_handler(wbrequest)
            else:
                raise


    @staticmethod
    def _wrap_session_path(path, cdx_lines):
        for cdx in cdx_lines:
            cdx['filename'] = os.path.join(path, cdx['filename'])
            if cdx.get('orig.filename', '-') != '-':
                cdx['orig.filename'] = os.path.join(path,
                                                    cdx['orig.filename'])
            yield cdx


#=================================================================
class DynRecord(RewriteHandler):
    def __init__(self, config):
        super(DynRecord, self).__init__(config)
        cookie_name = config.get('cookie_name', 'beaker.session.id')
        self.record_path = config.get('record_dir', './')

    def get_top_frame_params(self, wbrequest, mod):
        params = (super(DynRecord, self).
                  get_top_frame_params(wbrequest, mod))

        manager = wbrequest.env.get('w_manager')

        if manager:
            user, coll = wbrequest.custom_params['sesh_id'].split('/', 1)
            info = manager.get_info(user, coll)
            params['info'] = json.dumps(info)

        return params

    def _ignore_proxies(self, wbrequest):
        return wbrequest.env.get('webrec.no_space', False)

    def _live_request_headers(self, wbrequest):
        path = wbrequest.custom_params.get('output_dir')
        if not path:
            path = self.record_path

        if not self._ignore_proxies(wbrequest):
            sesh_id = wbrequest.custom_params['sesh_id']
            sesh_id = sesh_id.replace('/', ':')
            user_id = wbrequest.custom_params['user_id']

            target = dict(output_dir=path,
                          sesh_id=sesh_id,
                          user_id=user_id,
                          name_prefix=wbrequest.env.get('w_nameprefix', ''))
            req_headers = {'warcprox-meta': json.dumps(target)}
        else:
            req_headers = {}

        # reset HTTP_COOKIE to guarded request_cookie for LiveRewriter
        if 'webrec.request_cookie' in wbrequest.env:
            wbrequest.env['HTTP_COOKIE'] = wbrequest.env['webrec.request_cookie']

        try:
            del wbrequest.env['HTTP_X_PUSH_STATE_REQUEST']
        except:
            pass

        return req_headers

    def _make_response(self, wbrequest, status_headers, gen, is_rewritten):
        if (status_headers.get_statuscode() == '500' and
            status_headers.get_header('X-Archive-Orig-x-warcprox-error') == '500'):
            msg = 'This url could not be recorded: '
            raise LiveResourceException(msg, url=wbrequest.wb_url.url)

        return WbResponse(status_headers, gen)


#=================================================================
# Not Used Currently
class DynUrlRewriter(UrlRewriter):
    def rewrite(self, url, mod=None):
        new_url = super(DynUrlRewriter, self).rewrite(url, mod)
        if new_url == url:
            return new_url

        parts = new_url.split('://', 1)
        if len(parts) < 2:
            return new_url

        rand = base64.b32encode(os.urandom(5))
        parts[1] = rand + '.' + parts[1]

        #print('DYN RW 2')
        #host = parts[2].split('.')[0]
        #parts[1] = host + '.' + parts[1]
        new_url = '://'.join(parts)
        return new_url
