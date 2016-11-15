from gevent.monkey import patch_all; patch_all()

from .testutils import BaseWRTests
import os

from gevent.wsgi import WSGIServer
import gevent


# ============================================================================
class FullStackTests(BaseWRTests):
    #def _setup_class(cls, *args, **kwargs):
    @classmethod
    def custom_init(cls, kwargs):
        agg_port = 0
        rec_port = 0

        os.environ['TEMP_SLEEP_CHECK'] = '5'

        os.environ['APP_HOST'] = ''
        os.environ['CONTENT_HOST'] = ''

        cls.agg_serv = None
        cls.rec_serv = None

        if kwargs.get('agg', True):
            from webrecorder.load.main import make_webagg
            cls.agg_serv = RandomPortServer(make_webagg(), 'WEBAGG_HOST')

        if kwargs.get('rec', True):
            from webrecorder.rec.main import init as record_init
            cls.rec_serv = RandomPortServer(record_init(), 'RECORD_HOST')

    @classmethod
    def teardown_class(cls, *args, **kwargs):
        if cls.agg_serv:
            cls.agg_serv.stop()

        if cls.rec_serv:
            cls.rec_serv.stop()

        super(FullStackTests, cls).teardown_class(*args, **kwargs)


# ============================================================================
class GeventApp(object):
    def __init__(self, app, var_name):
        self.var_name = var_name
        self.make_server(app)

    def stop(self):
        if self.server:
            self.server.stop()

    def run(self, server, port):
        print('starting server on ' + str(port))
        server.serve_forever()


# ============================================================================
class RandomPortServer(GeventApp):
    def make_server(self, app):
        server = WSGIServer(('localhost', 0), app)
        server.init_socket()
        port = server.address[1]

        self.server = server
        self.ge = gevent.spawn(self.run, server, port)

        os.environ[self.var_name] = 'http://localhost:{0}'.format(port)


# ============================================================================
class UnixSockServer(GeventApp):
    def make_server(self, app):
        self.dn = tempfile.mkdtemp()
        self.socket_name = os.path.join(self.dn, next(tempfile._get_candidate_names()) + '.sock')

        s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        try:
            s.bind(self.socket_name)
        except:
            raise Exception(str(self.fh))

        s.listen(10)
        s.setblocking(0)

        server = WSGIServer(s, app)
        self.server = server
        self.ge = gevent.spawn(self.run, server)

        os.environ[self.var_name] = 'unix://' + self.socket_name

    def stop(self):
        os.shutil(self.dn)
        super(UnixSockServer, self).stop()




