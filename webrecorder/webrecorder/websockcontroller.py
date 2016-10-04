from bottle import Bottle, request, HTTPError, response, HTTPResponse, redirect
import time
import json

from webrecorder.basecontroller import BaseController

try:
    import uwsgi
except:
    pass


# ============================================================================
class WebsockController(BaseController):
    def __init__(self, app, jinja_env, manager, config):
        super(WebsockController, self).__init__(app, jinja_env, manager, config)
        self.status_update_secs = float(config['status_update_secs'])

        #TODO: move to config
        self.from_ip_q = 'from_ip:q:'
        self.tick_time = 0.25

    def init_routes(self):
        @self.app.get('/_client_ws')
        def client_ws():
            try:
                return self.client_ws()
            except OSError:
                request.environ['webrec.ws_closed'] = True
                return

        @self.app.get('/_client_ws_cont')
        def client_ws_cont():
            try:
                return self.client_ws_cont()
            except OSError:
                request.environ['webrec.ws_closed'] = True
                return

    def init_cont_browser_sesh(self):
        remote_addr = request.environ.get('HTTP_X_PROXY_FOR')
        if not remote_addr:
            remote_addr = request.environ['REMOTE_ADDR']

        container_data = self.manager.browser_redis.hgetall('ip:' + remote_addr)

        if not container_data or 'user' not in container_data:
            print('Data not found for remote ' + remote_addr)
            return

        sesh = self.get_session()
        sesh.set_restricted_user(container_data['user'])
        container_data['ip'] = remote_addr
        return container_data

    def get_status(self, user, coll, rec):
        size = self.manager.get_size(user, coll, rec)
        if size is not None:
            result = {'ws_type': 'status'}
            result['size'] = size
            result['numPages'] = self.manager.count_pages(user, coll, rec)

        else:
            result = {'ws_type': 'error',
                      'error_message': 'not found'}

        return json.dumps(result)

    def _init_ws(self, env):
        uwsgi.websocket_handshake(env['HTTP_SEC_WEBSOCKET_KEY'],
                                  env.get('HTTP_ORIGIN', ''))

    def _recv_ws(self):
        return uwsgi.websocket_recv_nb()

    def _send_ws(self, msg):
        uwsgi.websocket_send(msg)

    def _pop_from_remote_q(self, ip):
        return self.manager.browser_redis.lpop(self.from_ip_q + ip)

    def _push_to_remote_q(self, ip, msg):
        string = json.dumps(msg)
        self.manager.browser_redis.rpush(self.from_ip_q + ip, string)

    def client_ws(self):
        user, coll = self.get_user_coll(api=True)
        rec = request.query.getunicode('rec', '*')
        last_status = None
        last_status_time = time.time()

        self._init_ws(request.environ)

        data = {}
        if request.query.get('browserIP'):
            data['remote_ip'] = request.query.get('browserIP')

        while True:
            self.handle_client_msg(self._recv_ws(), user, coll, rec, data)

            if 'remote_ip' in data:
                msg = self._pop_from_remote_q(data['remote_ip'])
                if msg:
                    self._send_ws(msg)

            curr_time = time.time()

            if (curr_time - last_status_time) > self.status_update_secs:
                status = self.get_status(user, coll, rec)

                if status != last_status:
                    self._send_ws(status)
                    last_status = status

                last_status_time = curr_time

            time.sleep(self.tick_time)

    def client_ws_cont(self):
        info = self.init_cont_browser_sesh()
        if not info:
            return {'error_message': 'conn not from valid containerized browser'}

        user = info['user']
        coll = info['coll']
        rec = info['rec']

        self._init_ws(request.environ)

        data = {'cbrowser_ip': info['ip']}

        while True:
            self.handle_client_msg(self._recv_ws(), user, coll, rec, data)
            time.sleep(self.tick_time)

    def handle_client_msg(self, msg, user, coll, rec, data):
        if not msg:
            return

        cbrowser_ip = data.get('cbrowser_ip')

        msg = json.loads(msg.decode('utf-8'))

        if msg['ws_type'] == 'skipreq':
            url = msg['url']
            if not user:
                user = self.manager.get_anon_user()

            self.manager.skip_post_req(user, url)

        elif msg['ws_type'] == 'addcookie':
            self.manager.add_cookie(user, coll, rec,
                            msg['name'], msg['value'], msg['domain'])

        elif msg['ws_type'] == 'page':
            if not self.manager.has_recording(user, coll, rec):
                print('Invalid Rec for Page Data', user, coll, rec)
                return

            page_data = msg['page']

            res = self.manager.add_page(user, coll, rec, page_data)

            if cbrowser_ip and msg.get('visible'):
                msg['ws_type'] = 'remote_url'
                self._push_to_remote_q(cbrowser_ip, msg)

        elif cbrowser_ip and msg['ws_type'] == 'remote_url':
            self._push_to_remote_q(cbrowser_ip, msg)

        elif msg['ws_type'] == 'remote_ip':
            data['remote_ip'] = msg['ip']


