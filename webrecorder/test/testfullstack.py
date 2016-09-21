from gevent.monkey import patch_all; patch_all()

from .testutils import BaseWRTests
import os

from gevent.wsgi import WSGIServer
import gevent


# ============================================================================
class FullStackTests(BaseWRTests):
    @classmethod
    def setup_class(cls, *args, **kwargs):
        agg_port = 30080
        rec_port = 30090

        os.environ['WEBAGG_HOST'] = 'http://localhost:{0}'.format(agg_port)
        os.environ['RECORD_HOST'] = 'http://localhost:{0}'.format(rec_port)

        os.environ['TEMP_SLEEP_CHECK'] = '5'

        os.environ['APP_HOST'] = ''
        os.environ['CONTENT_HOST'] = ''

        super(FullStackTests, cls).setup_class(*args, **kwargs)

        if kwargs.get('agg', True):
            cls.agg_greenlet = cls.init_webagg(agg_port)
        else:
            cls.agg_greenlet = None

        if kwargs.get('rec', True):
            cls.rec_greenlet = cls.init_rec(agg_port, rec_port)
        else:
            cls.rec_greenlet = None

    @classmethod
    def teardown_class(cls, *args, **kwargs):
        if cls.agg_greenlet:
            cls.agg_greenlet.kill(block=True)

        if cls.rec_greenlet:
            cls.rec_greenlet.kill(block=True)

        super(FullStackTests, cls).teardown_class(*args, **kwargs)

    @classmethod
    def init_webagg(cls, port):
        from webrecorder.load.main import make_webagg
        greenlet, port = cls.make_gevent_server(make_webagg(), port)
        return greenlet

    @classmethod
    def init_rec(cls, agg_port, rec_port):
        from webrecorder.rec.main import init
        greenlet, port = cls.make_gevent_server(init(), rec_port)
        return greenlet

    @classmethod
    def make_gevent_server(cls, app, port=0):
        server = WSGIServer(('localhost', port), app)

        def run(server):
            print('starting server on ' + str(port))
            server.serve_forever()

        g = gevent.spawn(run, server)
        return g, port
