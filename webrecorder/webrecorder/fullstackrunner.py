from gevent.monkey import patch_all; patch_all()

from pywb.utils.geventserver import GeventServer

from webrecorder.rec.tempchecker import TempChecker
from webrecorder.rec.storagecommitter import StorageCommitter
from webrecorder.rec.worker import Worker

import os
import traceback
import gevent

try:
    from geventwebsocket.handler import WebSocketHandler
    ws_handler_class = WebSocketHandler
except:
    ws_handler_class = None


# ==================================================================
class FullStackRunner(object):
    def __init__(self, app_port=8090, rec_port=0, warc_port=0, env_params=None,
                 run_tempchecker=False, run_storagecommitter=False):

        if env_params:
            os.environ.update(env_params)

        def warcserver():
            from webrecorder.load.main import WRWarcServer
            return WRWarcServer().app

        def recorder():
            from webrecorder.rec.main import init as record_init
            return record_init()

        def app():
            from webrecorder.maincontroller import MainController
            app = MainController().app
            return app

        self.warc_serv = self.init_server(warc_port, warcserver, 'WARCSERVER_HOST')
        self.rec_serv = self.init_server(rec_port, recorder, 'RECORD_HOST')
        self.app_serv = self.init_server(app_port, app, 'APP_HOST')

        self.storage_worker = Worker(StorageCommitter) if run_storagecommitter else None
        if self.storage_worker:
            gevent.spawn(self.storage_worker.run)

        self.temp_worker = Worker(TempChecker) if run_tempchecker else None
        if self.temp_worker:
            gevent.spawn(self.temp_worker.run)

    def close(self):
        if self.temp_worker:
            self.temp_worker.stop()
            self.temp_worker = None

        if self.storage_worker:
            self.storage_worker.stop()
            self.storage_worker = None

        self.stop_server(self.warc_serv)
        self.stop_server(self.rec_serv)
        self.stop_server(self.app_serv)

        # try closing writer
        try:
            if self.rec_serv:
                self.rec_serv.server.application.wr.close()
                #self.rec_serv.server.application.wr.writer.close()
        except Exception as e:
            traceback.print_exc()

    def init_server(self, port, func, env_var_name=None):
        if port < 0:
            return None

        result = GeventServer(func(), port, handler_class=ws_handler_class)

        if env_var_name:
            os.environ[env_var_name] = 'http://localhost:{0}'.format(result.port)
            print(env_var_name + '=' + os.environ[env_var_name], flush=True)

        return result

    def stop_server(self, serv):
        if serv:
            serv.stop()

