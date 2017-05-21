from gevent import monkey; monkey.patch_all()

from webrecorder.utils import load_wr_config, init_logging
from webrecorder.rec.webrecrecorder import WebRecRecorder

import gevent


# =============================================================================
def init():
    init_logging()

    config = load_wr_config()

    wr = WebRecRecorder(config)

    gevent.spawn(wr.msg_listen_loop)

    wr.init_app(None)
    wr.app.wr = wr

    return wr.app


