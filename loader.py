from pywb.webapp.pywb_init import DirectoryCollsLoader
from pywb.cdx.cdxsource import CDXFile
from pywb.cdx.cdxserver import CDXServer
from pywb.framework.archivalrouter import Route
from pywb.webapp.handlers import WBHandler
from pywb.webapp.live_rewrite_handler import RewriteHandler, LiveResourceException

from pywb.framework.wbrequestresponse import WbResponse

import os
import re

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
class DynamicRoute(Route):
    def apply_filters(self, wbrequest, matcher):
        groups = matcher.groups()
        if len(groups) > 0:
            result = self.filters[0].format(*groups)
            wbrequest.custom_params['coll_path'] = result


#=================================================================
class DynCDXServer(CDXServer):
    def _create_cdx_sources(self, paths, config):
        self.sources = [DynCDXFile(paths)]


#=================================================================
class DynCDXFile(CDXFile):
    """
    Represents a parametric cdx file
    """
    def __init__(self, filename):
        self.root_path = ''
        self.param_file = filename

    def load_cdx(self, query):
        path = query.params['coll_path']

        if not path:
            print 'No Path'
            return iter([])

        self.filename = os.path.join(self.root_path,
                                     path,
                                     self.param_file)

        print('CDX: ' + self.filename)
        return super(DynCDXFile, self).load_cdx(query)

    def __str__(self):
        return 'Dyn CDX File - ' + self.root_path


#=================================================================
class DynWBHandler(WBHandler):
    #def _init_replay_view(self, config):
    #    return super(DynWBHandler, self)._init_replay_view(config)

    def handle_replay(self, wbrequest, cdx_lines):
        path = wbrequest.custom_params['coll_path']
        path = os.path.join(path, 'archive')
        print('Replay: ' + path)

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
        cookie_name = 'beaker.session'
        self.strip_cookie_re = re.compile(cookie_name + '=[^ ]+([ ]|$)')

    def _live_request_headers(self, wbrequest):
        path = wbrequest.custom_params['coll_path']
        path = os.path.join(path, 'archive')

        req_headers = {'x-warcprox-params': 'target=' + path}

        cookie = wbrequest.env.get('HTTP_COOKIE')
        if cookie:
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
                'cookie_scope': 'default'}

        return live
