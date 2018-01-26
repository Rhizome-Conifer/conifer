from webrecorder.models import SessionUser, User, Collection, Recording
from bottle import template, request, HTTPError

from webrecorder.models.base import BaseAccess
from six.moves.urllib.parse import quote, urlsplit

from webrecorder.utils import redis_pipeline


# ============================================================================
class RedisDataManager(object):
    def __init__(self, redis, cork, content_app, browser_redis, browser_mgr, config):
        self.redis = redis
        self.cork = cork
        self.config = config

        self.content_app = content_app

        if self.content_app:
            self.content_app.manager = self

        self.browser_redis = browser_redis
        self.browser_mgr = browser_mgr

        # custom cork auth decorators
        self.admin_view = self.cork.make_auth_decorator(role='admin',
                                                        fixed_role=True,
                                                        fail_redirect='/_login')
        self.auth_view = self.cork.make_auth_decorator(role='archivist',
                                                       fail_redirect='/_login')
        self.beta_user = self.cork.make_auth_decorator(role='beta-archivist',
                                                       fail_redirect='/_login')


        self.default_max_anon_size = int(config['default_max_anon_size'])
        self.temp_prefix = config['temp_prefix']

        self.dyn_stats_key_templ = config['dyn_stats_key_templ']
        self.dyn_ref_templ = config['dyn_ref_templ']

        self.dyn_stats_secs = config['dyn_stats_secs']

    def is_valid_user(self, user):
        if user.is_anon():
            return True

        return self.cork.user(user.my_id) is not None

    def get_host(self):
        return request.urlparts.scheme + '://' + request.urlparts.netloc

    def _res_url_templ(self, base_templ, params, url):
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

    def get_dyn_stats(self, user, coll, rec, sesh_id, url):
        params = {'user': user,
                  'coll': coll,
                  'rec': rec,
                  'id': sesh_id}

        dyn_stats_key = self._res_url_templ(self.dyn_stats_key_templ,
                                             params, url)

        stats = self.redis.hgetall(dyn_stats_key)
        if stats:
            self.redis.expire(dyn_stats_key, self.dyn_stats_secs)

        return stats

