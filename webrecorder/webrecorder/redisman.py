import six
import time
import redis


# ============================================================================
class RedisDataManager(object):
    REC_INFO_KEY = 'r:{user}:{coll}:{rec}:info'

    def __init__(self, redis, cork, config):
        self.redis = redis
        self.cork = cork

        self._set_init_defaults(config)

    def _set_init_defaults(self, config):
        try:
            if not self.redis.exists('h:defaults'):
                self.redis.hset('h:defaults', 'max_len', config['default_max_size'])
                self.redis.hset('h:defaults', 'max_anon_len', config['default_max_anon_size'])
                self.redis.hset('h:defaults', 'max_coll', config['default_max_coll'])
        except Exception as e:
            print('WARNING: Unable to init defaults: ' + str(e))

    def get_recording(self, user, coll, rec):
        key = self.REC_INFO_KEY.format(user=user, coll=coll, rec=rec)
        result = self._format_rec_info(self.redis.hgetall(key))
        return result

    def create_recording(self, user, coll, rec, rec_title):
        key = self.REC_INFO_KEY.format(user=user, coll=coll, rec=rec)

        now = int(time.time())

        with redis.utils.pipeline(self.redis) as pi:
            pi.hset(key, 'id', rec)
            pi.hset(key, 'title', rec_title)
            pi.hset(key, 'created_at', now)
            pi.hset(key, 'updated_at', now)
            pi.hset(key, 'size', '0')

        return self.get_recording(user, coll, rec)

    def get_recordings(self, user, coll):
        key_pattern = self.REC_INFO_KEY.format(user=user, coll=coll, rec='*')

        keys = list(self.redis.scan_iter(match=key_pattern))

        with redis.utils.pipeline(self.redis) as pi:
            for key in keys:
                pi.hgetall(key)

            all_recs = pi.execute()

        all_recs = [self._format_rec_info(x) for x in all_recs]
        return all_recs

    def _format_rec_info(self, result):
        if not result:
            return {}

        result = self._conv_dict(result)
        result = self._to_int(result, ['size', 'created_at', 'updated_at'])
        #result['id'] = id
        return result

    def _to_int(self, result, ints):
        for x in ints:
            result[x] = int(result[x])
        return result

    def _conv_dict(self, result):
        if six.PY2 or not result:
            return result

        return dict(((n.decode('utf-8'), v.decode('utf-8')) for n, v in result.items()))

