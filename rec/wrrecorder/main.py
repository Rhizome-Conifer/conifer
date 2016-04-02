from gevent import monkey; monkey.patch_all()

from wrrecorder.webrecrecorder import WebRecRecorder
from wrrecorder.anonchecker import AnonChecker

from pywb.utils.loaders import load_yaml_config

import gevent
import os


# =============================================================================
#def start_uwsgi_timer(freq, type_, callable_, signal=66):
#    import uwsgi
#    uwsgi.register_signal(signal, type_, callable_)
#    uwsgi.add_timer(signal, freq)

#start_uwsgi_timer(5, "mule", run_anon_checker)

#def run_anon_checker(self, signum=None):
#    anon_checker()


wr = None

# =============================================================================
def anon_checker_loop(anon_checker):
    while True:
        anon_checker()
        gevent.sleep(30)


# =============================================================================
def init():
    config = load_yaml_config(os.environ.get('WR_CONFIG', './wr.yaml'))

    anon_checker = AnonChecker(config)

    global wr
    wr = WebRecRecorder(config)

    gevent.spawn(anon_checker_loop, anon_checker)

    return wr.app


# =============================================================================
application = init()


