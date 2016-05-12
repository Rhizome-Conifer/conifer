from gevent import monkey; monkey.patch_all()

from wrrecorder.webrecrecorder import WebRecRecorder
from wrrecorder.anonchecker import AnonChecker
from wrrecorder.storagecommitter import StorageCommitter

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
def anon_checker_loop(anon_checker, sleep_secs):
    print('Running anon delete check every {0}'.format(sleep_secs))
    while True:
        anon_checker()
        gevent.sleep(sleep_secs)


# =============================================================================
def storage_commit_loop(storage_committer, writer, sleep_secs):
    print('Running storage committer {0}'.format(sleep_secs))
    while True:
        writer.close_idle_files()

        storage_committer()
        gevent.sleep(sleep_secs)



# =============================================================================
def init():
    config = load_yaml_config(os.environ.get('WR_CONFIG', './wr.yaml'))

    anon_checker = AnonChecker(config)
    storage_committer = StorageCommitter(config)

    global wr
    wr = WebRecRecorder(config)

    sleep_secs = int(os.environ.get('ANON_SLEEP_CHECK', 30))

    gevent.spawn(anon_checker_loop, anon_checker, sleep_secs)

    gevent.spawn(storage_commit_loop, storage_committer, wr.writer, sleep_secs)

    return wr.app


# =============================================================================
application = init()


