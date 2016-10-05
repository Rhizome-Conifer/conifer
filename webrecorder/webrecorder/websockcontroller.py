from bottle import Bottle, request, HTTPError, response, HTTPResponse, redirect
import time
import json
import gevent

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
        self.from_ip_ps = 'from_ip:ps:'
        self.to_ip_ps = 'to_ip:ps:'
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

        container_local_store = self.manager.browser_redis.hgetall('ip:' + remote_addr)

        if not container_local_store or 'user' not in container_local_store:
            print('Data not found for remote ' + remote_addr)
            return

        sesh = self.get_session()
        sesh.set_restricted_user(container_local_store['user'])
        container_local_store['ip'] = remote_addr
        return container_local_store

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

    def _multiplex(self, websocket_fd, pubsub, user, coll, rec, local_store):
        if pubsub:
            fd_list = [websocket_fd, pubsub.connection._sock.fileno()]
        else:
            fd_list = [websocket_fd]

        # wait max 4 seconds to allow ping to be sent
        ready = gevent.select.select(fd_list, [], [], 4.0)
        # send ping on timeout
        if not ready[0]:
            uwsgi.websocket_recv_nb()

        for fd in ready[0]:
            if fd == websocket_fd:
                self.handle_client_msg(self._recv_ws(), user, coll, rec, local_store)
            elif len(fd_list) == 2 and fd == fd_list[1]:

                ps_msg = pubsub.get_message(ignore_subscribe_messages=True)
                if ps_msg and ps_msg['type'] == 'message':
                    self._send_ws(ps_msg['data'])

    def client_ws(self):
        user, coll = self.get_user_coll(api=True)
        rec = request.query.getunicode('rec', '*')
        last_status = None
        last_status_time = time.time()

        self._init_ws(request.environ)

        local_store = {}
        pubsub = None

        if request.query.get('browserIP'):
            self.init_remote_comm(local_store, request.query.get('browserIP'))

        websocket_fd = uwsgi.connection_fd()

        while True:
            self._multiplex(websocket_fd, local_store.get('pubsub'),
                            user, coll, rec, local_store)

            curr_time = time.time()

            if (curr_time - last_status_time) > self.status_update_secs:
                status = self.get_status(user, coll, rec)

                if status != last_status:
                    self._send_ws(status)
                    last_status = status

                last_status_time = curr_time

    def client_ws_cont(self):
        info = self.init_cont_browser_sesh()
        if not info:
            return {'error_message': 'conn not from valid containerized browser'}

        user = info['user']
        coll = info['coll']
        rec = info['rec']
        ip = info['ip']

        self._init_ws(request.environ)

        local_store = {'cbrowser_ip': ip}

        pubsub = self.manager.browser_redis.pubsub()
        pubsub.subscribe([self.to_ip_ps + ip])

        websocket_fd = uwsgi.connection_fd()

        while True:
            self._multiplex(websocket_fd, pubsub,
                            user, coll, rec, local_store)

    def handle_client_msg(self, msg, user, coll, rec, local_store):
        if not msg:
            return

        cbrowser_ip = local_store.get('cbrowser_ip')

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

            page_local_store = msg['page']

            res = self.manager.add_page(user, coll, rec, page_local_store)

            if cbrowser_ip and msg.get('visible'):
                msg['ws_type'] = 'remote_url'
                self._publish(self.from_ip_ps + cbrowser_ip, msg)
                #self._push_to_remote_q(cbrowser_ip, msg)

        elif cbrowser_ip and msg['ws_type'] == 'remote_url':
            #self._push_to_remote_q(cbrowser_ip, msg)
            self._publish(self.from_ip_ps + cbrowser_ip, msg)

        elif msg['ws_type'] == 'remote_ip':
            self.init_remote_comm(local_store, msg['ip'])

        elif 'to_channel' in local_store:
        # send to remote browser cmds
            if msg['ws_type'] in ('set_url', 'autoscroll', 'load_all'):
                self._publish(local_store['to_channel'], msg)

    def _publish(self, channel, msg):
        self.manager.browser_redis.publish(channel, json.dumps(msg))

    def init_remote_comm(self, local_store, ip):
        local_store['remote_ip'] = ip
        local_store['to_channel'] = self.to_ip_ps + ip

        local_store['pubsub'] = self.manager.browser_redis.pubsub()
        local_store['pubsub'].subscribe(self.from_ip_ps + ip)
        return local_store['pubsub']

