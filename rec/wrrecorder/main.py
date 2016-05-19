from gevent import monkey; monkey.patch_all()

from wrrecorder.webrecrecorder import WebRecRecorder
from wrrecorder.tempchecker import TempChecker
from wrrecorder.storagecommitter import StorageCommitter

from pywb.utils.loaders import load_yaml_config

import gevent
import os

from wrrecorder.s3 import S3Storage


# =============================================================================
#def start_uwsgi_timer(freq, type_, callable_, signal=66):
#    import uwsgi
#    uwsgi.register_signal(signal, type_, callable_)
#    uwsgi.add_timer(signal, freq)

#start_uwsgi_timer(5, "mule", run_temp_checker)

#def run_temp_checker(self, signum=None):
#    temp_checker()


wr = None

# =============================================================================
def temp_checker_loop(temp_checker, sleep_secs):
    print('Running temp delete check every {0}'.format(sleep_secs))
    while True:
        temp_checker()
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

    temp_checker = TempChecker(config)
    storage_committer = StorageCommitter(config)

    storage_committer.add_storage_class('s3', S3Storage)

    global wr
    wr = WebRecRecorder(config, storage_committer)

    sleep_secs = int(os.environ.get('TEMP_SLEEP_CHECK', 30))

    gevent.spawn(temp_checker_loop, temp_checker, sleep_secs)

    gevent.spawn(storage_commit_loop, storage_committer, wr.writer, sleep_secs)

    return wr.app


# =============================================================================
application = init()


