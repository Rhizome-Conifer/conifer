from pywb.cdx.cdxsource import CDXFile, RedisCDXSource
from pywb.cdx.cdxserver import CDXServer

from pywb.framework.archivalrouter import Route

from pywb.webapp.pywb_init import DirectoryCollsLoader
from pywb.webapp.handlers import WBHandler
from pywb.webapp.live_rewrite_handler import RewriteHandler, LiveResourceException
from pywb.webapp.views import J2TemplateView

from pywb.framework.wbrequestresponse import WbResponse
from pywb.utils.wbexception import NotFoundException

import functools
import os
import re
import json


#=================================================================
class switch_dir(object):
    def __init__(self, newdir):
        self.origcwd = os.getcwd()
        self.newdir = newdir

    def __enter__(self):
        os.chdir(self.newdir)
        return self

    def __exit__(self, *args):
        os.chdir(self.origcwd)


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
        wbrequest.coll = sesh_id


#=================================================================
class DynCDXServer(CDXServer):
    def _create_cdx_sources(self, paths, config):
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
        cdx_key = 'cdxj:' + sesh_id

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
class DynWBHandler(WBHandler):
    #def _init_replay_view(self, config):
    #    return super(DynWBHandler, self)._init_replay_view(config)

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
            if cdx.get('orig.filename', '-') != '-':
                cdx['orig.filename'] = os.path.join(path,
                                                    cdx['orig.filename'])
            yield cdx


#=================================================================
class DynRecord(RewriteHandler):
    def __init__(self, config):
        super(DynRecord, self).__init__(config)
        cookie_name = 'beaker.session.id'
        self.strip_cookie_re = re.compile(cookie_name + '=[^ ]+([ ]|$)')
        self.record_path = config.get('record_dir', './')

    def _live_request_headers(self, wbrequest):
        path = wbrequest.custom_params.get('output_dir')
        if not path:
            path = self.record_path

        sesh_id = wbrequest.custom_params.get('sesh_id', wbrequest.coll)

        target = dict(output_dir=path,
                      sesh_id=sesh_id)

        req_headers = {'x-warcprox-meta': json.dumps(target)}

        cookie = wbrequest.env.get('HTTP_COOKIE')
        if False and cookie:
            cookie = self._cleanse_cookie(cookie)
            if cookie == '':
                del wbrequest.env['HTTP_COOKIE']
            else:
                wbrequest.env['HTTP_COOKIE'] = cookie

        return req_headers

    def _cleanse_cookie(self, cookie_str):
        return self.strip_cookie_re.sub('', cookie_str, 1).strip()

    def _make_response(self, wbrequest, status_headers, gen, is_rewritten):
        if (status_headers.get_statuscode() == '500' and
            status_headers.get_header('X-Archive-Orig-x-warcprox-error') == '500'):
            raise LiveResourceException(err, url=wbrequest.wb_url.url)

        status_headers.headers.append(('Cache-Control', 'no-cache'))

        return WbResponse(status_headers, gen)


#=================================================================
class RecordDirLoader(DirectoryCollsLoader):
    def __call__(self):
        colls = super(RecordDirLoader, self).__call__()
        new_colls = {}

        for n, v in colls.iteritems():
            new_colls[n] = v
            v['index_paths'] = self.config['index_paths'] + '/cdxj:' + n
            record_path = '({0})-record'.format(n)
            new_colls[record_path] = self.add_live_web_coll(v['archive_paths'])
            print(v)

        return new_colls

    def add_live_web_coll(self, path):
        live = {'index_paths': '$liveweb',
                'cookie_scope': 'default',
                'coll_group': 1,
                'wb_handler_class': DynRecord,
                'record_dir': path}
        return live


#=================================================================
class AccountUserLoader(object):
    def __init__(self, config, static_routes):
        self.config = config
        self.static_routes = static_routes
        self.colls = {}

    def __call__(self):
        for usr in os.listdir('users'):
            full = os.path.join('users', usr)
            with switch_dir(full):
                r = DirectoryCollsLoader(self.config, self.static_routes)
                r = r()

                colls = {}
                for n, v in r.iteritems():
                    name = usr + '/' + n
                    colls[name + '/record'] = self.add_live_web_coll()
                    colls[name] = v

                self.colls.update(colls)

        return self.colls

    def add_live_web_coll(self):
        live = {'index_paths': '$liveweb',
                'cookie_scope': 'de}ault'}

        return live
