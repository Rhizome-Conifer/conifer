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

    def client_ws(self):
        user, coll = self.get_user_coll(api=True)
        rec = request.query.getunicode('rec', '*')

        reqid = request.query.get('reqid')
        if reqid:
            sesh_id = self.manager.browser_mgr.browser_sesh_id(reqid)
        else:
            sesh_id = self.get_session().get_id()

        if not user:
            user = self.manager.get_anon_user()

        type_ = request.query.get('type')

        # starting url (for stats reporting)
        url = request.query.getunicode('url')
        if url:
            stats_urls = [url]
        else:
            stats_urls = []

        WebSockHandler('to', reqid, self.manager,
                       'to_cbr_ps:', 'from_cbr_ps:',
                       user, coll, rec, sesh_id=sesh_id,
                       type=type_,
                       stats_urls=stats_urls,
                       status_update_secs=self.status_update_secs).run()

    def client_ws_cont(self):
        info = self.manager.browser_mgr.init_cont_browser_sesh()
        if not info:
            return {'error_message': 'conn not from valid containerized browser'}

        user = info['user']
        coll = info['coll']
        rec = info['rec']

        reqid = info['reqid']
        sesh_id = self.get_session().get_id()

        browser = info['browser']

        type_ = info['type']

        if 'wsgi.websocket' in request.environ:
            cls = GeventWebSockHandler
        else:
            cls = WebSockHandler

        cls('from', reqid, self.manager,
            'from_cbr_ps:', 'to_cbr_ps:',
            user, coll, rec, type=type_,
            sesh_id=sesh_id,
            browser=browser).run()


# ============================================================================
class BaseWebSockHandler(object):
    def __init__(self, name, reqid, manager, send_to, recv_from,
                       user, coll, rec, sesh_id=None, type=None,
                       stats_urls=None, browser=None, status_update_secs=0):

        self.user = user
        self.coll = coll
        self.rec = rec
        self.browser = browser
        self.type_ = type

        self.sesh_id = sesh_id
        self.stats_urls = stats_urls or []

        self.manager = manager

        self.updater = None
        if status_update_secs:
            self.updater = StatusUpdater(status_update_secs, self)

        self.name = name
        self.channel = None
        self.pubsub = None

        self.reqid = reqid

        if reqid:
            self.channel = send_to + reqid

            self.pubsub = self.manager.browser_redis.pubsub()
            self.pubsub.subscribe(recv_from + reqid)

            if not hasattr(self.pubsub, 'connection'):
                self.pubsub = None

    def run(self):
        self._init_ws(request.environ)

        websocket_fd = self._get_ws_fd()

        while True:
            self._multiplex(websocket_fd)

            if self.updater:
                res = self.updater.get_update()
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

        accum_buff = None

        for fd in ready[0]:
            if fd == websocket_fd:
                buff = self._recv_ws()
                accum_buff = buff if not accum_buff else accum_buff + buff
                accum_buff = self.handle_client_msg(accum_buff)

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
            # limit msg to 64k, after reading chunks
            if len(msg) >= 16384 * 4:
                print('*** WS ERR, could not read message even after buffering', self.channel, e, len(msg))
                return

            return msg

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

                    check_dupes = (self.type_ == 'patch')

                    res = self.manager.add_page(self.user, self.coll, self.rec,
                                                page_local_store, check_dupes)
                else:
                    print('Invalid Rec for Page Data', self.user, self.coll, self.rec)

            if from_browser and msg.get('visible'):
                msg['ws_type'] = 'remote_url'

        elif msg['ws_type'] == 'config-stats':
            self.stats_urls = msg['stats_urls']

        elif msg['ws_type'] == 'set_url':
            self.stats_urls = [msg['url']]

        elif msg['ws_type'] == 'switch':
            if not self.manager.can_write_coll(self.user, self.coll):
                print('No Write Access')
                return

            self.rec = msg['rec']
            self.manager.browser_mgr.update_remote_browser(self.reqid,
                                                           rec=msg['rec'],
                                                           type_=msg['type'])

        # send to remote browser cmds
        if to_browser:
            if msg['ws_type'] in ('set_url', 'autoscroll', 'load_all', 'switch', 'snapshot-req'):
                self._publish(to_browser, msg)

        elif from_browser:
            if msg['ws_type'] in ('remote_url', 'patch_req', 'snapshot'):
                self._publish(from_browser, msg)

    def get_status(self):
        size = self.manager.get_size(self.user, self.coll, self.rec)
        if size is not None:
            # if extracting, also add the size from patch recording, if any
            if self.type_ == 'extract':
                patch_size = self.manager.get_size(self.user, self.coll, 'patch-of-' + self.rec)
                if patch_size is not None:
                    size += patch_size

            result = {'ws_type': 'status'}
            result['size'] = size
            result['numPages'] = self.manager.count_pages(self.user, self.coll, self.rec)

            if self.stats_urls:
                result['stats'] = self.get_dyn_stats()

        else:
            result = {'ws_type': 'error',
                      'error_message': 'not found'}

        return json.dumps(result)

    def get_dyn_stats(self):
        sum_stats = {}
        for url in self.stats_urls:
            stats = self.manager.get_dyn_stats(self.user, self.coll, self.rec,
                                                self.sesh_id, url)
            for stat, value in stats.items():
                sum_stats[stat] = int(value) + int(sum_stats.get(stat, 0))

        return sum_stats


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
        while not self._ws.closed:
            try:
                result = self._ws.receive()
            except Exception as e:
                break

            if result:
                self.q.put(result.encode('utf-8'))

    def _recv_ws(self):
        if self._ws.closed:
            raise OSError('WS Closed')

        try:
            return self.q.get_nowait()
        except gevent.queue.Empty as e:
            return None

    def _send_ws(self, msg):
        self._ws.send(msg)


# ============================================================================
class StatusUpdater(object):
    def __init__(self, status_update_secs, ws_handler):
        self.ws_handler = ws_handler

        self.last_status = None
        self.last_status_time = 0.0

        self.status_update_secs = status_update_secs

    def get_update(self):
        curr_time = time.time()
        result = None

        if (curr_time - self.last_status_time) > self.status_update_secs:
            status = self.ws_handler.get_status()

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



