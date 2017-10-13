from gevent import monkey; monkey.patch_all()

from webrecorder.utils import load_wr_config, init_logging
from webrecorder.rec.webrecrecorder import WebRecRecorder

import gevent
import uwsgi
from uwsgidecorators import postfork


# =============================================================================
def init():
    init_logging()

    config = load_wr_config()

    wr = WebRecRecorder(config)

    @postfork
    def listen_loop():
        if uwsgi.mule_id() == 0:
            gevent.spawn(wr.msg_listen_loop)

    wr.init_app(None)
    wr.app.wr = wr

    return wr.app


