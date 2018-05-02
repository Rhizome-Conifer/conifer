from warcio.limitreader import LimitReader
from pywb.utils.loaders import load_overlay_config
from contextlib import contextmanager

import re
import gevent
import logging
import datetime
import os
import base64


# ============================================================================
def init_logging():
    logging.basicConfig(format='%(asctime)s: [%(levelname)s]: %(message)s',
                        datefmt='%Y-%m-%d %H:%M:%S',
                        level=logging.WARNING)

    # set boto log to error
    boto_log = logging.getLogger('boto')
    if boto_log:
        boto_log.setLevel(logging.ERROR)

    tld_log = logging.getLogger('tldextract')
    if tld_log:
        tld_log.setLevel(logging.ERROR)

    try:
        from requests.packages.urllib3 import disable_warnings
        disable_warnings()
    except:
        pass


# ============================================================================
def load_wr_config():
    config = load_overlay_config('WR_CONFIG', 'pkg://webrecorder/config/wr.yaml', 'WR_USER_CONFIG', '')

    init_props(config)

    return config


# ============================================================================
def init_props(config):
    from webrecorder.models import User, Collection, Recording, Stats
    User.init_props(config)
    Collection.init_props(config)
    Recording.init_props(config)
    Stats.init_props(config)

    import webrecorder.rec.storage.storagepaths as storagepaths
    storagepaths.init_props(config)


# ============================================================================
def get_new_id():
    return base64.b32encode(os.urandom(10)).decode('utf-8').lower()


# ============================================================================
ALPHA_NUM_RX = re.compile('[^\w-]')

WB_URL_COLLIDE = re.compile('^([\d]+([\w]{2}_)?|([\w]{2}_))$')


def sanitize_tag(tag):
    id = tag.strip()
    id = id.replace(' ', '-')
    id = ALPHA_NUM_RX.sub('', id)
    if WB_URL_COLLIDE.match(id):
        id += '-'

    return id

def sanitize_title(title):
    id = title.lower().strip()
    id = id.replace(' ', '-')
    id = ALPHA_NUM_RX.sub('', id)
    if WB_URL_COLLIDE.match(id):
        id += '-'

    return id


# ============================================================================
def get_bool(value):
    if isinstance(value, str):
        return value.lower() not in ('0', 'false', 'f', 'off')

    return False if not value else True


# ============================================================================
def today_str():
    return datetime.datetime.utcnow().date().isoformat()


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
