from bottle import Bottle, request, HTTPError, response, HTTPResponse, redirect
import time
import json

import gevent
import gevent.queue

from webrecorder.basecontroller import BaseController


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

    def client_ws(self):
        user, coll = self.get_user_coll(api=True)
        rec = request.query.getunicode('rec', '*')

        reqid = request.query.get('reqid')

        updater = StatusUpdater(self.status_update_secs,
                                self.get_status)

        if not user:
            user = self.manager.get_anon_user()

        WebSockHandler('to', reqid, self.manager,
                       'to_cbr_ps:', 'from_cbr_ps:',
                       user, coll, rec,
                       updater=updater).run()



        return self.run_ws(user, coll, rec, local_store, updater)

    def client_ws_cont(self):
        info = self.manager.browser_mgr.init_cont_browser_sesh()
        if not info:
            return {'error_message': 'conn not from valid containerized browser'}

        user = info['user']
        coll = info['coll']
        rec = info['rec']

        reqid = info['reqid']

        browser = info['browser']

        type_ = info['type']

        WebSockHandler('from', reqid, self.manager,
                       'from_cbr_ps:', 'to_cbr_ps:',
                       user, coll, rec, type=type_,
                       browser=browser).run()


# ============================================================================
class BaseWebSockHandler(object):
    def __init__(self, name, reqid, manager, send_to, recv_from,
                       user, coll, rec, type=None, browser=None, updater=None):

        self.user = user
        self.coll = coll
        self.rec = rec
        self.browser = browser
        self.type_ = type

        self.manager = manager
        self.updater = updater

        self.name = name
        self.channel = None
        self.pubsub = None

        self.reqid = reqid

        if reqid:
            self.channel = send_to + reqid

            self.pubsub = self.manager.browser_redis.pubsub()
            self.pubsub.subscribe(recv_from + reqid)

    def run(self):
        self._init_ws(request.environ)

        websocket_fd = self._get_ws_fd()

        while True:
            self._multiplex(websocket_fd)

            if self.updater:
                res = self.updater.get_update(self.user, self.coll, self.rec)
                if res:
                    self._send_ws(res)

            gevent.sleep(0)

    def _multiplex(self, websocket_fd):
        fd_list = [websocket_fd]

        if self.pubsub:
            fd_list.append(self.pubsub.connection._sock.fileno())

        ready = gevent.select.select(fd_list, [], [], 1.0)

        # send ping on timeout
        if not ready[0]:
            self._recv_ws()

        for fd in ready[0]:
            if fd == websocket_fd:
                self.handle_client_msg(self._recv_ws())

            elif len(fd_list) == 2 and fd == fd_list[1]:

                ps_msg = self.pubsub.get_message(ignore_subscribe_messages=True)
                if ps_msg and ps_msg['type'] == 'message':
                    self._send_ws(ps_msg['data'])

    def _publish(self, channel, msg):
        self.manager.browser_redis.publish(channel, json.dumps(msg))

    def handle_client_msg(self, msg):
        if not msg:
            return

        to_browser = None
        from_browser = None
        if self.name == 'to':
            to_browser = self.channel
        else:
            from_browser = self.channel

        try:
            msg = json.loads(msg.decode('utf-8'))
        except Exception as e:
            print('WS MSG ERR', e, len(msg))
            return

        if msg['ws_type'] == 'skipreq':
            url = msg['url']
            self.manager.skip_post_req(self.user, url)

        elif msg['ws_type'] == 'addcookie':
            self.manager.content_app.add_cookie(self.user, self.coll, self.rec,
                            msg['name'], msg['value'], msg['domain'])

        elif msg['ws_type'] == 'page':
            if self.type_ != 'live':
                if self.manager.has_recording(self.user, self.coll, self.rec):
                    page_local_store = msg['page']

                    res = self.manager.add_page(self.user, self.coll, self.rec, page_local_store)
                else:
                    print('Invalid Rec for Page Data', self.user, self.coll, self.rec)

            if from_browser and msg.get('visible'):
                msg['ws_type'] = 'remote_url'

        elif msg['ws_type'] == 'switch':
            if not self.manager.can_write_coll(self.user, self.coll):
                print('No Write Access')
                return

            self.rec = msg['rec']
            self.manager.browser_mgr.switch_upstream(msg['rec'], msg['type'], self.reqid)

        # send to remote browser cmds
        if to_browser:
            if msg['ws_type'] in ('set_url', 'autoscroll', 'load_all', 'switch', 'snapshot-req'):
                self._publish(to_browser, msg)

        elif from_browser:
            if msg['ws_type'] in ('remote_url', 'patch_req', 'snapshot'):
                self._publish(from_browser, msg)


# ============================================================================
class UwsgiWebSockHandler(BaseWebSockHandler):
    def _get_ws_fd(self):
        return uwsgi.connection_fd()

    def _init_ws(self, env):
        uwsgi.websocket_handshake(env['HTTP_SEC_WEBSOCKET_KEY'],
                                  env.get('HTTP_ORIGIN', ''))

    def _recv_ws(self):
        return uwsgi.websocket_recv_nb()

    def _send_ws(self, msg):
        uwsgi.websocket_send(msg)


# ============================================================================
class GeventWebSockHandler(BaseWebSockHandler):
    def _get_ws_fd(self):
        socket = self._ws.stream.handler.socket
        return socket

    def _init_ws(self, env):
        self._ws = env['wsgi.websocket']

        self.q = gevent.queue.Queue()
        gevent.spawn(self._do_recv)

    def _do_recv(self):
        while True:
            try:
                result = self._ws.receive()
            except Exception as e:
                break

            if result:
                self.q.put(result.encode('utf-8'))

    def _recv_ws(self):
        try:
            return self.q.get_nowait()
        except:
            return None

    def _send_ws(self, msg):
        self._ws.send(msg)


# ============================================================================
class StatusUpdater(object):
    def __init__(self, status_update_secs, callback):
        self.last_status = None
        self.last_status_time = 0.0

        self.status_update_secs = status_update_secs
        self.callback = callback

    def get_update(self, user, coll, rec):
        curr_time = time.time()
        result = None

        if (curr_time - self.last_status_time) > self.status_update_secs:
            status = self.callback(user, coll, rec)

            if status != self.last_status:
                self.last_status = status
                result = status

            self.last_status_time = curr_time

        return result


# ============================================================================
try:
    import uwsgi
    WebSockHandler = UwsgiWebSockHandler
except:
    WebSockHandler = GeventWebSockHandler



