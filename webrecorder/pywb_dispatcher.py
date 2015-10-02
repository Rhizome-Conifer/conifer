from bottle import redirect, request, HTTPError, HTTPResponse

from os.path import expandvars
from datetime import datetime

from pywb.webapp.pywb_init import create_wb_router
from pywb.utils.loaders import load_yaml_config
from pywb.webapp.views import J2TemplateView
from pywb.utils.timeutils import datetime_to_timestamp
from pywb.utils.wbexception import WbException
from pywb.framework.wbrequestresponse import WbRequest

from rewriter import HTMLDomUnRewriter
import json
import requests


# ============================================================================
class PywbDispatcher(object):
    def __init__(self, app):
        self.pywb = create_wb_router(app.webrec.config)
        self.manager = app.webrec.manager
        self.path_parser = app.webrec.path_parser
        self.app = app

        proxy_path = expandvars(app.webrec.config['proxy_path'])
        self.warcprox_proxies = {'http': proxy_path,
                                 'https': proxy_path}

        self.init_routes()


    def call_pywb(self, user=None, coll=None, state=None):
        if user and coll:
            path = self.path_parser.get_coll_path(user, coll)
            request.path_shift(self.path_parser.get_path_shift())
            request.environ['w_output_dir'] = self.path_parser.get_archive_dir(user, coll)
            request.environ['w_sesh_id'] = path
            request.environ['w_manager'] = self.manager
            request.environ['w_user_id'] = 'u:' + user

            params = request.environ['pywb.template_params']
            params['state'] = state
            params['path'] = path
            params['user'] = user
            params['coll'] = coll

        try:
            resp = self.pywb(request.environ)
        except WbException as wbe:
            status = int(wbe.status().split(' ', 1)[0])
            raise HTTPError(status=status, body=str(wbe))

        if not resp:
            raise HTTPError(status=404, body='No Response Found')

        resp = HTTPResponse(body=resp.body,
                            status=resp.status_headers.statusline,
                            headers=resp.status_headers.headers)
        return resp

    def route(self, path, func, method='ANY'):
        self.app.route(path, method=method, callback=func)

    def init_routes(self):
        # pywb static and home
        self.route('/static/<:re:.*>', self.fallthrough, 'GET')

        # snapshot
        self.route('/_snapshot', self.snapshot, 'POST')

        path = self.path_parser.get_coll_path_template()

        # redir when no url
        self.route(path + '/<action>', self.redir_coll)

        # pywb Replay / Patch / Record
        self.route(path + '/<action:re:(record|patch)>/<:re:.*>', self.record)

        # live preview
        self.route(path + '/<action:re:(live)>/<:re:.*>', self.replay)

        # cdx
        self.route(path + '/cdx', self.fallthrough, 'GET')

        # replay
        self.route(path + '/<:re:.*>', self.replay)


        # pywb static and home
        self.route('/<:re:.*>', self.fallthrough)


    def fallthrough(self):
        return self.call_pywb()


    def redir_coll(self, user, coll, action):
        redirect('/' + self.path_parser.get_coll_path(user, coll))


    def record(self, user, coll, action):
        if not self.manager.can_write_coll(user, coll):
            raise HTTPError(status=404, body='No Such Collection')

        if not self.manager.has_space(user):
            self.app.request.environ['webrec.no_space'] = True

        return self.call_pywb(user, coll, action)


    def replay(self, user, coll, action='replay'):
        if not self.manager.can_read_coll(user, coll):
            raise HTTPError(status=404, body='No Such Collection')

        return self.call_pywb(user, coll, action)


    def cdx(self, user, coll):
        if not self.manager.can_read_coll(user, coll):
            raise HTTPError(status=404, body='No Such Collection')

        return self.call_pywb(user, coll, 'cdx')


    def snapshot(self):
        path = request.query.get('coll', '')
        user, coll = self.path_parser.get_user_coll(path)
        url = request.query.get('url', '')
        if not url or not self.manager.can_write_coll(user, coll):
            raise HTTPError(status=404, body='No Such Page')

        title = request.query.get('title', '')
        add_page = request.query.get('addpage', False)

        html_text = request.body.read()

        #host = get_host()
        host = WbRequest.make_host_prefix(request.environ)

        prefix = request.query.get('prefix', host)

        orig_html = HTMLDomUnRewriter.unrewrite_html(host, prefix, html_text)

        dt = datetime.utcnow()

        target = dict(output_dir=self.path_parser.get_archive_dir(user, coll),
                      sesh_id=path.replace('/', ':'),
                      user_id=user,
                      json_metadata={'snapshot': 'html', 'timestamp': str(dt)},
                      writer_type='-snapshot')

        if url.startswith('https://'):
            url = url.replace('https:', 'http:')

        req_headers = {'warcprox-meta': json.dumps(target),
                       'content-type': 'text/html',
                       'user-agent': request.headers.get('user-agent')
                      }

        pagedata = {'url': url,
                    'title': title,
                    'tags': ['snapshot'],
                    'ts': datetime_to_timestamp(dt)
                   }

        try:
            resp = requests.request(method='PUTRES',
                                    url=url,
                                    data=orig_html,
                                    headers=req_headers,
                                    proxies=self.warcprox_proxies,
                                    verify=False)

            if add_page:
                self.manager.add_page(user, coll, pagedata)
        except:
            return {'status': 'err'}


        return {'status': resp.status_code}
