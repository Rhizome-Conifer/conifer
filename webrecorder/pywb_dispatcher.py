from bottle import redirect, request, HTTPError, HTTPResponse, route

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

        self.init_early_routes()

    def call_pywb(self, user=None, coll=None, state=None, anon=False):
        if anon:
            wrsesh = request.environ['webrec.session']
            if state != 'live' and wrsesh.curr_user:
                wrsesh.flash_message('You are logged in. Please select a collection to record or browse', 'info')
                redirect('/' + wrsesh.curr_user)
                return

            user = wrsesh.anon_user
            coll = '@anon'
            path = '@anon'
            coll_path = 'replay'
            curr_path = state
            sesh_id = self.path_parser.get_coll_path(user, coll)

            if state == 'record' or state == 'patch':
                user = self.manager.get_anon_user()
                if not self.manager.has_space(user):
                    request.environ['webrec.no_space'] = True

            elif state == 'replay':
                request.path_shift(1)

        elif user and coll:
            request.path_shift(self.path_parser.get_path_shift())

            sesh_id = self.path_parser.get_coll_path(user, coll)
            path = sesh_id
            curr_path = path
            coll_path = path

            if state != 'replay':
                curr_path += '/' + state


        if anon or (user and coll):
            output_dir = self.path_parser.get_archive_dir(user, coll)
            name_prefix = self.path_parser.get_name_prefix(user, coll)

            request.environ['w_output_dir'] = output_dir
            request.environ['w_sesh_id'] = sesh_id
            request.environ['w_path'] = path
            request.environ['w_nameprefix'] = name_prefix
            request.environ['w_manager'] = self.manager
            request.environ['w_user_id'] = 'u:' + user

            params = request.environ['pywb.template_params']
            params['state'] = state
            params['user'] = user
            params['coll'] = coll
            params['path'] = coll_path
            params['curr_path'] = curr_path


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
        route(path, method=method, callback=func)


    def init_early_routes(self):
        # pywb static and home
        self.route('/live/<path:path>', self.live_anon, ['GET', 'POST'])

        self.route('/record/<path:path>', self.record_anon, ['GET', 'POST'])

        self.route('/patch/<path:path>', self.patch_anon, ['GET', 'POST'])

        self.route('/replay/<path:path>', self.replay_anon, ['GET', 'POST'])

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
            request.environ['webrec.no_space'] = True

        return self.call_pywb(user, coll, action)


    def replay(self, user, coll, action='replay'):
        if not self.manager.can_read_coll(user, coll):
            raise HTTPError(status=404, body='No Such Collection')

        return self.call_pywb(user, coll, action)

    def live_anon(self, path=None):
        return self.call_pywb(None, None, 'live', anon=True)

    def record_anon(self, path=None):
        return self.call_pywb(None, None, 'record', anon=True)

    def patch_anon(self, path=None):
        return self.call_pywb(None, None, 'patch', anon=True)

    def replay_anon(self, path=None):
        return self.call_pywb(None, None, 'replay', anon=True)

    def cdx(self, user, coll):
        if not self.manager.can_read_coll(user, coll):
            raise HTTPError(status=404, body='No Such Collection')

        return self.call_pywb(user, coll, 'cdx')


    def snapshot(self):
        coll = request.query.get('coll', '')
        if coll == '@anon':
            user = self.manager.get_anon_user()
        else:
            user, coll = self.path_parser.get_user_coll(coll)

        url = request.query.get('url', '')
        if not url or not self.manager.can_write_coll(user, coll):
            raise HTTPError(status=404, body='No Such Page')

        title = request.query.get('title', '')
        add_page = request.query.get('addpage', False)

        html_text = request.body.read().decode('utf-8')

        #host = get_host()
        host = WbRequest.make_host_prefix(request.environ)

        prefix = request.query.get('prefix', host)

        orig_html = HTMLDomUnRewriter.unrewrite_html(host, prefix, html_text)

        dt = datetime.utcnow()

        sesh_id = self.path_parser.get_coll_path(user, coll)

        target = dict(output_dir=self.path_parser.get_archive_dir(user, coll),
                      sesh_id=sesh_id.replace('/', ':'),
                      user_id=user,
                      name_prefix=self.path_parser.get_name_prefix(user, coll),
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
