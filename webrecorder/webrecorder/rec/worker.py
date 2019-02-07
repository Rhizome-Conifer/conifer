import time
import traceback
import os

from webrecorder.utils import load_wr_config

import logging
logger = logging.getLogger('wr.io')


# ============================================================================
class Worker(object):
    def __init__(self, worker_cls):
        self._running = True

        self.sleep_secs = int(os.environ.get('TEMP_SLEEP_CHECK', 30))
        logger.info('Worker: Running {0} every {1}'.format(worker_cls.__name__, self.sleep_secs))

        config = load_wr_config()

        self.worker = worker_cls(config)

    def stop(self):
        self._running = False

    def run(self):
        while self._running:
            try:
                self.worker()

            except:
                traceback.print_exc()

            finally:
                time.sleep(self.sleep_secs)

