from bottle import Bottle, request, HTTPError, response, HTTPResponse, redirect
import time
import json
import os

import gevent
import gevent.queue

from webrecorder.basecontroller import BaseController
from webrecorder.models.dynstats import DynStats
from webrecorder.models.stats import Stats


# ============================================================================
class WebsockController(BaseController):
    def __init__(self, *args, **kwargs):
        super(WebsockController, self).__init__(*args, **kwargs)
        config = kwargs['config']
        self.status_update_secs = float(config['status_update_secs'])

        self.browser_mgr = kwargs['browser_mgr']
        self.content_app = kwargs['content_app']

        self.dyn_stats = DynStats(self.redis, config)
        self.stats = Stats(self.redis)

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
        user, collection = self.load_user_coll()
        rec = request.query.getunicode('rec')
        recording = collection.get_recording(rec)

        if not self.access.can_read_coll(collection):
            self._raise_error(404, 'not_found')

        reqid = request.query.get('reqid')

        if reqid:
            reqid = self.browser_mgr.browser_resolve_reqid(reqid)
            sesh_id = self.browser_mgr.browser_sesh_id(reqid)
        else:
            sesh_id = self.get_session().get_id()

        type_ = request.query.get('type')

        # starting url (for stats reporting)
        url = request.query.getunicode('url')
        if url:
            stats_urls = [url]
        else:
            stats_urls = []

        WebSockHandler('to', reqid, self,
                       'to_cbr_ps:', 'from_cbr_ps:',
                       user, collection, recording, sesh_id=sesh_id,
                       type=type_,
                       stats_urls=stats_urls,
                       status_update_secs=self.status_update_secs).run()

    def client_ws_cont(self):
        info = self.browser_mgr.init_remote_browser_session()
        if not info:
            return {'error_message': 'conn not from valid containerized browser'}

        user = info['user']
        coll = info['coll']
        rec = info['rec']
        rec_name = info.get('rec_name', '')
        coll_name = info.get('coll_name', '')

        user = self.user_manager.all_users.make_user(user)
        collection = user.get_collection_by_id(coll, coll_name)
        recording = collection.get_recording(rec)

        reqid = info['reqid']
        sesh_id = self.get_session().get_id()

        browser = info['browser']

        type_ = info['type']

        if 'wsgi.websocket' in request.environ:
            cls = GeventWebSockHandler
        else:
            cls = WebSockHandler

        cls('from', reqid, self,
            'from_cbr_ps:', 'to_cbr_ps:',
            user, collection, recording, type=type_,
            sesh_id=sesh_id,
            browser=browser).run()


# ============================================================================
class BaseWebSockHandler(object):
    def __init__(self, name, reqid, websock_controller, send_to, recv_from,
                       user, collection, recording, sesh_id=None, type=None,
                       stats_urls=None, browser=None, status_update_secs=0):

        self.user = user
        self.collection = collection
        self.recording = recording
        self.browser = browser
        self.type_ = type

        self.browser_mgr = websock_controller.browser_mgr
        self.browser_redis = self.browser_mgr.browser_redis
        self.content_app = websock_controller.content_app
        self.access = websock_controller.access

        self.dyn_stats = websock_controller.dyn_stats
        self.stats = websock_controller.stats

        self.sesh_id = sesh_id
        self.stats_urls = stats_urls or []

        self.updater = None
        if status_update_secs:
            self.updater = StatusUpdater(status_update_secs, self)

        self.name = name
        self.channel = None
        self.pubsub = None

        self.reqid = reqid

        if reqid:
            self.channel = send_to + reqid

            self.pubsub = self.browser_redis.pubsub()
            self.pubsub.subscribe(recv_from + reqid)

            if not hasattr(self.pubsub, 'connection'):
                self.pubsub = None

    def run(self):
        self._init_ws(request.environ)

        accum_buff = None

        while True:
            # read WS
            buff = self._recv_ws()
            if buff:
                accum_buff = buff if not accum_buff else accum_buff + buff
                accum_buff = self.handle_client_msg(accum_buff)

            # read pubsub
            if self.pubsub:
                ps_msg = self.pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
                if ps_msg and ps_msg['type'] == 'message':
                    self._send_ws(ps_msg['data'])

            if self.updater:
                res = self.updater.get_update()
                if res:
                    self._send_ws(res)

            gevent.sleep(1.0)

    def _publish(self, channel, msg):
        self.browser_redis.publish(channel, json.dumps(msg))

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
            self.user.mark_skip_url(msg['url'])

        elif msg['ws_type'] == 'addcookie':
            self.content_app.add_cookie(self.user, self.collection, self.recording,
                                        msg['name'], msg['value'], msg['domain'])

        elif msg['ws_type'] == 'load':
            if self.type_ != 'live':
                if self.recording and msg.get('newPage'):
                    page_local_store = {'url': msg.get('url'),
                                        'timestamp': msg.get('ts'),
                                        'title': msg.get('title'),
                                        'browser': msg.get('browser')}

                    check_dupes = (self.type_ == 'patch')

                    self.collection.add_page(page_local_store, self.recording)

        elif msg['ws_type'] == 'config-stats':
            self.stats_urls = msg['stats_urls']

        elif msg['ws_type'] == 'replace-url':
            self.stats_urls = [msg['url']]

        elif msg['ws_type'] == 'behavior-stat':
            self.stats.incr_behavior_stat(msg.get('type'), msg.get('name'), self.browser)

        elif msg['ws_type'] == 'behavior':
            self.stats.incr_behavior_stat('start', msg.get('name'), self.browser)

        elif msg['ws_type'] == 'behaviorDone':
            self.stats.incr_behavior_stat('done', msg.get('name'), self.browser)

        elif msg['ws_type'] == 'reload':
            #TODO: check this
            if not self.access.can_write_coll(self.collection):
                print('No Write Access')
                return

            self.rec = msg['rec']
            self.browser_mgr.update_remote_browser(self.reqid,
                                                   rec=msg['rec'],
                                                   type_=msg['type'])

        # send to remote browser cmds
        if to_browser:
            if msg['ws_type'] in ('replace-url', 'behavior', 'reload'):
                self._publish(to_browser, msg)

        elif from_browser:
            if msg['ws_type'] in ('replace-url', 'load', 'patch_req', 'behaviorDone', 'behaviorStop', 'behaviorStep'):
                self._publish(from_browser, msg)

    def get_status(self):
        size = self.recording.size if self.recording else self.collection.size

        if size is None:
            result = {'ws_type': 'error', 'error': 'not_found'}
            return json.dumps(result)

        result = {'ws_type': 'status'}
        result['size'] = size

        if self.recording:
            pending_size = self.recording.get_pending_size()

            # if extracting, also add the size from patch recording, if any
            if self.type_.startswith('extract'):
                patch_recording = self.recording.get_patch_recording()
                if patch_recording:
                    patch_size = patch_recording.size
                    pending_size += patch_recording.get_pending_size()
                    if patch_size is not None:
                        size += patch_size

            result['pending_size'] = pending_size

        if self.stats_urls:
            result['stats'] = self.dyn_stats.get_dyn_stats(
                                self.user,
                                self.collection,
                                self.recording,
                                self.sesh_id,
                                self.stats_urls)

        return json.dumps(result)


# ============================================================================
class UwsgiWebSockHandler(BaseWebSockHandler):
    def _init_ws(self, env):
        uwsgi.websocket_handshake(env['HTTP_SEC_WEBSOCKET_KEY'],
                                  env.get('HTTP_ORIGIN', ''))

    def _recv_ws(self):
        return uwsgi.websocket_recv_nb()

    def _send_ws(self, msg):
        uwsgi.websocket_send(msg)


# ============================================================================
class GeventWebSockHandler(BaseWebSockHandler):
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



