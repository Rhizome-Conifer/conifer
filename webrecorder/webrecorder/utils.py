from pywb.webagg.utils import load_config
from pywb.utils.loaders import LimitReader
import gevent


# ============================================================================
def load_wr_config():
    return load_config('WR_CONFIG', 'pkg://webrecorder/config/wr.yaml', 'WR_USER_CONFIG', '')


# ============================================================================
class CacheingLimitReader(LimitReader):
    def __init__(self, stream, length, out):
        super(CacheingLimitReader, self).__init__(stream, length)
        self.out = out

    def read(self, size=-1):
        buff = super(CacheingLimitReader, self).read(size)
        self.out.write(buff)
        return buff


# ============================================================================
class SizeTrackingWriter(object):
    def __init__(self, redis, key):
        self.redis = redis
        self.key = key

    def write(self, buff):
        gevent.sleep(0)

        self.redis.hincrby(self.key, 'size', len(buff))


# ============================================================================
class SizeTrackingReader(CacheingLimitReader):
    def __init__(self, stream, length, redis, key):
        super(SizeTrackingReader, self).__init__(stream, length,
                                                 SizeTrackingWriter(redis, key))



