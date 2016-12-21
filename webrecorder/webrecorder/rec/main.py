from gevent import monkey; monkey.patch_all()

from webrecorder.rec.webrecrecorder import WebRecRecorder
from webrecorder.rec.tempchecker import TempChecker
from webrecorder.rec.storagecommitter import StorageCommitter

from webrecorder import load_wr_config

import gevent
import os

from webrecorder.rec.s3 import S3Storage


# =============================================================================
#def start_uwsgi_timer(freq, type_, callable_, signal=66):
#    import uwsgi
#    uwsgi.register_signal(signal, type_, callable_)
#    uwsgi.add_timer(signal, freq)

#start_uwsgi_timer(5, "mule", run_temp_checker)

#def run_temp_checker(self, signum=None):
#    temp_checker()


#wr = None

# =============================================================================
def temp_checker_loop(temp_checker, sleep_secs):
    print('Running temp delete check every {0}'.format(sleep_secs))
    while True:
        try:
            temp_checker()
            gevent.sleep(sleep_secs)
        except:
            import traceback
            traceback.print_exc()


# =============================================================================
def storage_commit_loop(storage_committer, writer, sleep_secs):
    print('Running storage committer {0}'.format(sleep_secs))
    while True:
        try:
            writer.close_idle_files()

            storage_committer()
            gevent.sleep(sleep_secs)
        except:
            import traceback
            traceback.print_exc()


# =============================================================================
def init(local_only=False):
    config = load_wr_config()

    temp_checker = None
    storage_committer = None

    wr = WebRecRecorder(config)

    if not local_only:
        temp_checker = TempChecker(config)
        storage_committer = StorageCommitter(config)

        storage_committer.add_storage_class('s3', S3Storage)

        sleep_secs = int(os.environ.get('TEMP_SLEEP_CHECK', 30))

        gevent.spawn(temp_checker_loop, temp_checker, sleep_secs)
        gevent.spawn(wr.msg_listen_loop)

    wr.init_app(storage_committer)

    if not local_only:
        gevent.spawn(storage_commit_loop, storage_committer, wr.writer, sleep_secs)

    wr.app.wr = wr

    return wr.app


