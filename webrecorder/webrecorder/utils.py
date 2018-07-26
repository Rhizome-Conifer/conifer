# standard library imports
import re
import logging
from contextlib import contextmanager

# third party imports
import gevent

# library specific imports
from warcio.limitreader import LimitReader
from pywb.utils.loaders import load_overlay_config


ALPHA_NUM_RX = re.compile('[^\w-]')
WB_URL_COLLIDE = re.compile('^([\d]+([\w]{2}_)?|([\w]{2}_))$')


def init_logging():
    """Initialize logging."""
    logging.basicConfig(
        format='%(asctime)s: [%(levelname)s]: %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        level=logging.WARNING
    )
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


def load_wr_config():
    """Load Webrecorder configuration.

    :returns: Webrecorder configuration
    :rtype: dict
    """
    config = load_overlay_config(
        'WR_CONFIG', 'pkg://webrecorder/config/wr.yaml', 'WR_USER_CONFIG', ''
    )
    return config


def sanitize_tag(tag):
    """Sanitize tag.

    :param str tag: tag

    :returns: sanitized tag
    :rtype: str
    """
    id = tag.strip()
    id = id.replace(' ', '-')
    id = ALPHA_NUM_RX.sub('', id)
    if WB_URL_COLLIDE.match(id):
        id += '-'

    return id

def sanitize_title(title):
    """Sanitize title.

    :param str title: title

    :returns: sanitized title
    :rtype: str
    """
    id = title.lower().strip()
    id = id.replace(' ', '-')
    id = ALPHA_NUM_RX.sub('', id)
    if WB_URL_COLLIDE.match(id):
        id += '-'

    return id


def get_bool(string):
    """Cast str to bool.

    :param str string: str

    :returns: bool
    :rtype: bool
    """
    if not string:
        return False

    return string.lower() not in ('0', 'false', 'f', 'off')


@contextmanager
def redis_pipeline(redis_obj):
    """Returns pipeline object that can queue multiple commands for later
    execution.

    :param StrictRedis redis_obj: Redis interface
    """
    p = redis_obj.pipeline(transaction=False)
    yield p
    p.execute()


class CacheingLimitReader(LimitReader):
    """Reader reading only chunks of pre-defined size of I/O stream.

    :ivar SpooledTemporaryFile out: temporary file
    :ivar int lenread: length of read chunk
    :ivar bool closed:
    """

    def __init__(self, stream, length, out):
        """Initialize reader.

        :param bytes stream: I/O stream
        :param int length: chunk size
        :param SpooledTemporaryFile out: temporary file
        """
        super().__init__(stream, length)
        self.out = out
        self.lenread = 0
        self.closed = False

    def read(self, size=-1):
        buff = super().read(size)
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
