import os
from datetime import datetime
from webrecorder.utils import redis_pipeline, today_str

from pywb.warcserver.index.cdxobject import CDXObject


# ============================================================================
class Stats(object):
    USER_USAGE_KEY = 'st:user-usage'
    TEMP_USAGE_KEY = 'st:temp-usage'
    PATCH_USAGE_KEY = 'st:patch-usage'

    TEMP_PREFIX = 'temp-'

    BROWSERS_KEY = 'st:br:{0}'

    DOWNLOADS_KEY = 'st:downloads'
    DOWNLOADS_PROP = 'num_downloads'

    UPLOADS_KEY = 'st:uploads'
    UPLOADS_PROP = 'num_uploads'

    SOURCES_KEY = 'st:ra:{0}'

    RATE_LIMIT_KEY = 'ipr:{ip}:{H}'
    RATE_LIMIT_HOURS = 0
    RATE_LIMIT_TTL = 0

    @classmethod
    def init_props(cls, config):
        cls.RATE_LIMIT_HOURS = int(os.environ.get('RATE_LIMIT_HOURS', 0))
        cls.RATE_LIMIT_TTL = cls.RATE_LIMIT_HOURS * 60 * 60

        cls.TEMP_PREFIX = config['temp_prefix']

    def __init__(self, redis):
        self.redis = redis

    def get_rate_limit_key(self, params):
        if not self.RATE_LIMIT_KEY or not self.RATE_LIMIT_TTL:
            return None

        ip = params.get('param.ip')
        if not ip:
            return None

        dt = datetime.utcnow()
        h = dt.strftime('%H')
        rate_limit_key = self.RATE_LIMIT_KEY.format(ip=ip, H=h)
        return rate_limit_key

    def incr_record(self, params, size, cdx_list):
        username = params.get('param.user')
        if not username:
            return

        today = today_str()

        with redis_pipeline(self.redis) as pi:
            # rate limiting
            rate_limit_key = self.get_rate_limit_key(params)
            if rate_limit_key:
                pi.incrby(rate_limit_key, size)
                pi.expire(rate_limit_key, self.RATE_LIMIT_TTL)

            # write size to usage hashes
            if username.startswith(self.TEMP_PREFIX):
                key = self.TEMP_USAGE_KEY
            else:
                key = self.USER_USAGE_KEY

            if key:
                pi.hincrby(key, today, size)

        is_extract = params.get('sources') != None
        is_patch = params.get('param.recorder.rec') != None

        if is_extract or is_patch:
            with redis_pipeline(self.redis) as pi:
                for cdx in cdx_list:
                    try:
                        cdx = CDXObject(cdx)
                        source_id = cdx['orig_source_id']
                        size = int(cdx['length'])
                        if source_id and size:
                            pi.hincrby(self.SOURCES_KEY.format(source_id), today, size)
                    except Exception as e:
                        pass

                if is_patch:
                    pi.hincrby(self.PATCH_USAGE_KEY, today, size)

    def incr_browser(self, browser_id):
        browser_key = self.BROWSERS_KEY.format(browser_id)
        self.redis.hincrby(browser_key, today_str(), 1)

    def incr_download(self, collection):
        collection.incr_key(self.DOWNLOADS_PROP, 1)
        self.redis.hincrby(self.DOWNLOADS_KEY, today_str(), 1)

    def incr_upload(self, user):
        user.incr_key(self.UPLOADS_PROP, 1)
        self.redis.hincrby(self.UPLOADS_KEY, today_str(), 1)

