from webrecorder.utils import redis_pipeline

# ============================================================================
class DynStats(object):
    def __init__(self, redis, config):
        self.redis = redis
        self.config = config

        self.dyn_stats_key_templ = config['dyn_stats_key_templ']
        self.dyn_ref_templ = config['dyn_ref_templ']
        self.dyn_cookie_templ = config['dyn_cookie_templ']

        self.dyn_stats_secs = config['dyn_stats_secs']

    def _res_url_templ(self, base_templ, params, url=''):
        rec = params['rec']
        if not rec or rec == '*':
            base_url = base_templ['coll']
        else:
            base_url = base_templ['rec']

        return base_url.format(coll=params['coll'],
                               rec=rec,
                               id=params['id']) + url

    def update_dyn_stats(self, url, params, referrer, source, ra_recording):
        if referrer.endswith('.css'):
            css_res = self._res_url_templ(self.dyn_ref_templ, params, referrer)
            orig_referrer = self.redis.get(css_res)
            if orig_referrer:
                referrer = orig_referrer

        dyn_stats_key = self._res_url_templ(self.dyn_stats_key_templ,
                                             params, referrer)

        curr_url_key = self._res_url_templ(self.dyn_stats_key_templ,
                                           params, url)

        with redis_pipeline(self.redis) as pi:
            pi.delete(curr_url_key)

            pi.hincrby(dyn_stats_key, source, 1)
            pi.expire(dyn_stats_key, self.dyn_stats_secs)

            if url.endswith('.css'):
                css_res = self._res_url_templ(self.dyn_ref_templ, params, url)
                pi.setex(css_res, self.dyn_stats_secs, referrer)

            if ra_recording:
                ra_recording.track_remote_archive(pi, source)

    def get_dyn_stats(self, user, collection, recording, sesh_id, stats_urls):
        params = {'user': user.name,
                  'coll': collection.my_id,
                  'rec': recording.my_id if recording else 0,
                  'id': sesh_id}

        sum_stats = {}

        for url in stats_urls:
            dyn_stats_key = self._res_url_templ(self.dyn_stats_key_templ,
                                                params, url)

            stats = self.redis.hgetall(dyn_stats_key)
            if not stats:
                continue

            self.redis.expire(dyn_stats_key, self.dyn_stats_secs)

            for stat, value in stats.items():
                sum_stats[stat] = int(value) + int(sum_stats.get(stat, 0))


        return sum_stats

    def get_cookie_key(self, user, collection, recording, sesh_id):
        params = {'user': user.name,
                  'coll': collection.my_id,
                  'rec': recording.my_id if recording else 0,
                  'id': sesh_id}

        return self._res_url_templ(self.dyn_cookie_templ, params)
