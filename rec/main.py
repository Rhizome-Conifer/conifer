from gevent import monkey; monkey.patch_all()

from webrecrecorder import WebRecRecorder
from anonchecker import AnonChecker

import gevent

# =============================================================================
#def start_uwsgi_timer(freq, type_, callable_, signal=66):
#    import uwsgi
#    uwsgi.register_signal(signal, type_, callable_)
#    uwsgi.add_timer(signal, freq)

#start_uwsgi_timer(5, "mule", run_anon_checker)

#def run_anon_checker(self, signum=None):
#    anon_checker()


# =============================================================================
anon_checker = AnonChecker()


def anon_checker_loop():
    while True:
        anon_checker()
        gevent.sleep(30)


# =============================================================================
gevent.spawn(anon_checker_loop)


wr = WebRecRecorder()
application = wr.app


