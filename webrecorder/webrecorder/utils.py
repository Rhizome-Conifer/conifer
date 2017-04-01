from warcio.limitreader import LimitReader
from pywb.webagg.utils import load_config
from contextlib import contextmanager
import gevent


# ============================================================================
def load_wr_config():
    return load_config('WR_CONFIG', 'pkg://webrecorder/config/wr.yaml', 'WR_USER_CONFIG', '')


# ============================================================================
@contextmanager
def redis_pipeline(redis_obj):
    p = redis_obj.pipeline(transaction=False)
    yield p
    p.execute()


# ============================================================================
class CacheingLimitReader(LimitReader):
    def __init__(self, stream, length, out):
        super(CacheingLimitReader, self).__init__(stream, length)
        self.out = out
        self.lenread = 0
        self.closed = False

    def read(self, size=-1):
        buff = super(CacheingLimitReader, self).read(size)
        self.out.write(buff)
        self.lenread += len(buff)
        return buff

    def tell(self):
        return self.lenread

    def readable(self):
        return True

    def writable(self):
        return False

    def seekable(self):
        return False


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

        self.closed = False

    def readable(self):
        return True

    def writable(self):
        return False

    def seekable(self):
        return False





