import os

from datetime import datetime
from webrecorder.utils import redis_pipeline, today_str

from pywb.warcserver.index.cdxobject import CDXObject


# ============================================================================
class Stats(object):
    TEMP_PREFIX = 'temp-'

    TEMP_MOVE_COUNT_KEY = 'st:temp-moves'
    TEMP_MOVE_SIZE_KEY = 'st:temp-moves-size'

    ALL_CAPTURE_USER_KEY = 'st:all-capture-user'
    ALL_CAPTURE_TEMP_KEY = 'st:all-capture-temp'

    REPLAY_USER_KEY = 'st:replay-user'
    REPLAY_TEMP_KEY = 'st:replay-temp'

    PATCH_USER_KEY = 'st:patch-user'
    PATCH_TEMP_KEY = 'st:patch-temp'

    DELETE_USER_KEY = 'st:delete-user'
    DELETE_TEMP_KEY = 'st:delete-temp'

    DELETE_PROP = 'size_deleted'

    DOWNLOADS_USER_COUNT_KEY = 'st:download-user-count'
    DOWNLOADS_USER_SIZE_KEY = 'st:download-user-size'

    DOWNLOADS_TEMP_COUNT_KEY = 'st:download-temp-count'
    DOWNLOADS_TEMP_SIZE_KEY = 'st:download-temp-size'

    DOWNLOADS_PROP = 'num_downloads'

    UPLOADS_COUNT_KEY = 'st:upload-count'
    UPLOADS_SIZE_KEY = 'st:upload-size'
    UPLOADS_PROP = 'num_uploads'

    BOOKMARK_ADD_KEY = 'st:bookmark-add'
    BOOKMARK_MOD_KEY = 'st:bookmark-mod'
    BOOKMARK_DEL_KEY = 'st:bookmark-del'

    BEHAVIOR_KEY = 'st:behaviors:{stat}:{name}'

    BROWSERS_KEY = 'st:br:{0}'

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
                key = self.ALL_CAPTURE_TEMP_KEY
            else:
                key = self.ALL_CAPTURE_USER_KEY

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
                    if username.startswith(self.TEMP_PREFIX):
                        key = self.PATCH_TEMP_KEY
                    else:
                        key = self.PATCH_USER_KEY

                    pi.hincrby(key, today, size)

    def incr_browser(self, browser_id):
        browser_key = self.BROWSERS_KEY.format(browser_id)
        self.redis.hincrby(browser_key, today_str(), 1)

    def incr_download(self, collection):
        user = collection.get_owner()
        if user.name.startswith(self.TEMP_PREFIX):
            count_key = self.DOWNLOADS_TEMP_COUNT_KEY
            size_key = self.DOWNLOADS_TEMP_SIZE_KEY
        else:
            count_key = self.DOWNLOADS_USER_COUNT_KEY
            size_key = self.DOWNLOADS_USER_SIZE_KEY

        collection.incr_key(self.DOWNLOADS_PROP, 1)
        today = today_str()
        self.redis.hincrby(count_key, today, 1)
        self.redis.hincrby(size_key, today, collection.size)

    def incr_delete(self, recording):
        try:
            user = recording.get_owner().get_owner()

            if user.name.startswith(self.TEMP_PREFIX):
                key = self.DELETE_TEMP_KEY
            else:
                key = self.DELETE_USER_KEY

            self.redis.hincrby(key, today_str(), recording.size)
            user.incr_key(self.DELETE_PROP, recording.size)

        except Exception as e:
            print('Error Counting Delete: ' + str(e))

    def incr_upload(self, user, size):
        user.incr_key(self.UPLOADS_PROP, 1)
        today = today_str()
        self.redis.hincrby(self.UPLOADS_COUNT_KEY, today, 1)
        self.redis.hincrby(self.UPLOADS_SIZE_KEY, today, size)

    def incr_bookmark_add(self, num=1):
        self.redis.hincrby(self.BOOKMARK_ADD_KEY, today_str(), num)

    def incr_bookmark_mod(self, num=1):
        self.redis.hincrby(self.BOOKMARK_MOD_KEY, today_str(), num)

    def incr_bookmark_del(self, num=1):
        self.redis.hincrby(self.BOOKMARK_DEL_KEY, today_str(), num)

    def incr_replay(self, size, username):
        if username.startswith(self.TEMP_PREFIX):
            key = self.REPLAY_TEMP_KEY
        else:
            key = self.REPLAY_USER_KEY

        self.redis.hincrby(key, today_str(), size)

    def move_temp_to_user_usage(self, collection):
        today = today_str()
        date_str = collection.get_created_iso_date()
        size = collection.size
        with redis_pipeline(self.redis) as pi:
            pi.hincrby(self.TEMP_MOVE_COUNT_KEY, today, 1)
            pi.hincrby(self.TEMP_MOVE_SIZE_KEY, today, size)
            pi.hincrby(self.ALL_CAPTURE_USER_KEY, date_str, size)
            pi.hincrby(self.ALL_CAPTURE_TEMP_KEY, date_str, -size)

    def incr_behavior_stat(self, stat, behavior, browser):
        if stat not in ('start', 'done'):
            return

        if not behavior:
            return

        key = self.BEHAVIOR_KEY.format(stat=stat, name=behavior)

        self.redis.hincrby(key, today_str(), 1)
