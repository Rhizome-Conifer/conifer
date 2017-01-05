from gevent.monkey import patch_all; patch_all()

import os
import traceback

from gevent.wsgi import WSGIServer
import gevent

try:
    from geventwebsocket.handler import WebSocketHandler
    ws_handler_class = WebSocketHandler
except:
    ws_handler_class = None


# ==================================================================
class FullStackRunner(object):
    def __init__(self, app_port=8090, rec_port=0, agg_port=0, env_params=None):

        if env_params:
            os.environ.update(env_params)

        def webagg():
            from webrecorder.load.main import make_webagg
            return make_webagg()

        def recorder():
            from webrecorder.rec.main import init as record_init
            return record_init()

        def app():
            from webrecorder.appcontroller import AppController
            app = AppController().app
            return app

        self.agg_serv = self.init_server(agg_port, webagg, 'WEBAGG_HOST')
        self.rec_serv = self.init_server(rec_port, recorder, 'RECORD_HOST')
        self.app_serv = self.init_server(app_port, app, 'APP_HOST')

    def close(self):
        self.stop_server(self.agg_serv)
        self.stop_server(self.rec_serv)
        self.stop_server(self.app_serv)

    def init_server(self, port, func, env_var_name=None):
        if port < 0:
            return None

        result = GeventServer(func(), port)

        if env_var_name:
            os.environ[env_var_name] = 'http://localhost:{0}'.format(result.port)
            print(env_var_name + '=' + os.environ[env_var_name])

        return result

    def stop_server(self, serv):
        if serv:
            serv.stop()


# ============================================================================
class GeventServer(object):
    def __init__(self, app, port):
        self.port = port
        self.make_server(app, port)

    def stop(self):
        if self.server:
            self.server.stop()

    def run(self, server, port):
        print('starting server on ' + str(port))
        try:
            server.serve_forever()
        except Exception as e:
            print('server stopped on ' + str(port))
            traceback.print_exc()

    def make_server(self, app, port=0):
        server = WSGIServer(('localhost', port), app, handler_class=ws_handler_class)
        server.init_socket()
        self.port = server.address[1]

        self.server = server
        self.ge = gevent.spawn(self.run, server, self.port)


