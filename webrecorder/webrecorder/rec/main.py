from gevent import monkey; monkey.patch_all()

from webrecorder.utils import load_wr_config, init_logging, spawn_once
from webrecorder.rec.webrecrecorder import WebRecRecorder


# =============================================================================
def init():
    init_logging(debug=True)

    config = load_wr_config()

    wr = WebRecRecorder(config)

    spawn_once(wr.msg_listen_loop)

    wr.init_app()
    wr.app.wr = wr

    return wr.app


