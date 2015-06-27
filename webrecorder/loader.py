from pywb.cdx.cdxsource import CDXFile, RedisCDXSource
from pywb.cdx.cdxserver import CDXServer

from pywb.framework.archivalrouter import Route

from pywb.webapp.pywb_init import DirectoryCollsLoader
from pywb.webapp.handlers import WBHandler
from pywb.webapp.live_rewrite_handler import RewriteHandler, LiveResourceException
from pywb.webapp.views import J2TemplateView

from pywb.framework.wbrequestresponse import WbResponse
from pywb.utils.wbexception import NotFoundException
from pywb.rewrite.url_rewriter import UrlRewriter

import functools
import os
import re
import json
import base64
from os.path import expandvars


#=================================================================
jinja_env = J2TemplateView.init_shared_env()

def jinja2_view(template_name):
    def decorator(view_func):
        @functools.wraps(view_func)
        def wrapper(*args, **kwargs):
            response = view_func(*args, **kwargs)

            if isinstance(response, dict):
                template = jinja_env.get_or_select_template(template_name)
                return template.render(**response)
            else:
                return response

        return wrapper

    return decorator


#=================================================================
class DynamicRoute(Route):
    def apply_filters(self, wbrequest, matcher):
        wbrequest.custom_params['output_dir'] = wbrequest.env.get('w_output_dir', '')

        sesh_id = wbrequest.env.get('w_sesh_id', '')
        wbrequest.custom_params['sesh_id'] = sesh_id
        wbrequest.custom_params['user_id'] = wbrequest.env.get('w_user_id', '')
        wbrequest.coll = sesh_id


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
            print 'No Path'
            return iter([])

        sesh_id = query.params['sesh_id']
        cdx_key = sesh_id.replace('/', ':') + ':cdxj'

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
            print 'No Path'
            return iter([])

        filename = os.path.join(self.root_path,
                                path,
                                self.param_file)

        return self._do_load_file(filename, query)

    def __str__(self):
        return 'Dyn CDX File - ' + self.root_path


#=================================================================
class DynRedisResolver(object):
    def __init__(self, redis, s3_target=None, proxy_target=None, key_prefix='w:'):
        self.redis = redis
        self.s3_target = s3_target
        self.proxy_target = proxy_target
        self.key_prefix = key_prefix

    def __call__(self, filename):
        sesh_id, warc_key = self._split_sesh_warc(filename)
        orig_path = self.redis.hget(sesh_id, warc_key)

        if not orig_path:
            return []

        # if proxy_path set, try proxy path first
        if self.s3_target and self.proxy_target:
            cached_path = orig_path.replace(self.s3_target, self.proxy_target)
            return [cached_path, orig_path]
        else:
            return [orig_path]

    def add_filename(self, filename, remote_url):
        sesh_id, warc_key = self._split_sesh_warc(filename)
        redis_val = self.redis.hset(sesh_id, warc_key, remote_url)

    def _split_sesh_warc(self, filename):
        #TODO: pass sesh_id here...
        parts = filename.rsplit('/')
        #return 'warc:' + parts[-5] + ':' + parts[-3], parts[-1]
        return parts[-5] + ':' + parts[-3] + ':warc', parts[-1]

    def __repr__(self):
        return "DynRedisResolver('{0}')".format(self.redis)


#=================================================================
class DynWBHandler(WBHandler):
    def _init_replay_view(self, config):
        replay = super(DynWBHandler, self)._init_replay_view(config)

        redis_warc_resolver = config.get('redis_warc_resolver')
        if redis_warc_resolver:
            replay.content_loader.path_resolvers.append(redis_warc_resolver)

        return replay

    def get_top_frame_params(self, wbrequest, mod):
        params = (super(DynWBHandler, self).
                  get_top_frame_params(wbrequest, mod))

        manager = wbrequest.env.get('w_manager')

        if manager:
            user, coll = wbrequest.coll.split('/', 1)
            info = manager.get_info(user, coll)
            params['info'] = json.dumps(info)

        return params

    def handle_replay(self, wbrequest, cdx_lines):
        path = wbrequest.custom_params['output_dir']
        #path = os.path.join(path, 'archive')

        cdx_callback = self.index_reader.cdx_load_callback(wbrequest)

        def wrapped_cdx_callback(*args, **kwargs):
            return self._wrap_session_path(path, cdx_callback(*args, **kwargs))

        wrapped_cdx_lines = self._wrap_session_path(path, cdx_lines)

        return self.replay.render_content(wbrequest,
                                          wrapped_cdx_lines,
                                          wrapped_cdx_callback)

    @staticmethod
    def _wrap_session_path(path, cdx_lines):
        for cdx in cdx_lines:
            cdx['filename'] = os.path.join(path, cdx['filename'])
            print(cdx['filename'])
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
            user, coll = wbrequest.coll.split('/', 1)
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
            sesh_id = wbrequest.custom_params.get('sesh_id', wbrequest.coll)
            sesh_id = sesh_id.replace('/', ':')
            user_id = wbrequest.custom_params.get('user_id')

            target = dict(output_dir=path,
                          sesh_id=sesh_id,
                          user_id=user_id)

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

        status_headers.headers.append(('Cache-Control', 'no-cache'))

        return WbResponse(status_headers, gen)


#=================================================================
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
