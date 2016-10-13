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

    def _multiplex(self, websocket_fd, local_store, user, coll, rec):
        fd_list = [websocket_fd]

        pubsub = local_store.get('pubsub')
        if pubsub:
            fd_list.append(pubsub.connection._sock.fileno())

        ready = gevent.select.select(fd_list, [], [], 1.0)

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

        reqid = request.query.get('reqid')

        local_store = self.init_remote_comm('to', reqid,
                                            'to_cbr_ps:', 'from_cbr_ps:')

        updater = StatusUpdater(self.status_update_secs,
                                lambda: self.get_status(user, coll, rec)
                               )

        return self.run_ws(user, coll, rec, local_store, updater)


    def client_ws_cont(self):
        info = self.init_cont_browser_sesh()
        if not info:
            return {'error_message': 'conn not from valid containerized browser'}

        user = info['user']
        coll = info['coll']
        rec = info['rec']

        reqid = info['reqid']

        local_store = self.init_remote_comm('from', reqid,
                                            'from_cbr_ps:', 'to_cbr_ps:')

        return self.run_ws(user, coll, rec, local_store)

    def run_ws(self, user, coll, rec, local_store, updater=None):
        self._init_ws(request.environ)

        websocket_fd = uwsgi.connection_fd()

        while True:
            self._multiplex(websocket_fd, local_store,
                            user, coll, rec)

            if updater:
                res = updater.get_update()
                if res:
                    self._send_ws(res)

            gevent.sleep(0)

    def handle_client_msg(self, msg, user, coll, rec, local_store):
        if not msg:
            return

        from_browser = local_store.get('from_channel')
        to_browser = local_store.get('to_channel')

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

            if from_browser and msg.get('visible'):
                msg['ws_type'] = 'remote_url'
                self._publish(from_browser, msg)
                #self._push_to_remote_q(cbrowser_ip, msg)

        elif from_browser and msg['ws_type'] == 'remote_url':
            #self._push_to_remote_q(cbrowser_ip, msg)
            self._publish(from_browser, msg)

        elif to_browser:
        # send to remote browser cmds
            if msg['ws_type'] in ('set_url', 'autoscroll', 'load_all'):
                self._publish(to_browser, msg)

    def _publish(self, channel, msg):
        self.manager.browser_redis.publish(channel, json.dumps(msg))

    def init_remote_comm(self, name, reqid, send_to, recv_from):
        if not reqid:
            return {}

        local_store = {'reqid': reqid}

        local_store[name + '_channel'] = send_to + reqid

        local_store['pubsub'] = self.manager.browser_redis.pubsub()
        local_store['pubsub'].subscribe(recv_from + reqid)
        return local_store



class StatusUpdater(object):
    def __init__(self, status_update_secs, callback):
        self.last_status = None
        self.last_status_time = 0.0

        self.status_update_secs = status_update_secs
        self.callback = callback

    def get_update(self):
        curr_time = time.time()
        result = None

        if (curr_time - self.last_status_time) > self.status_update_secs:
            status = self.callback()

            if status != self.last_status:
                self.last_status = status
                result = status

            self.last_status_time = curr_time

        return result

