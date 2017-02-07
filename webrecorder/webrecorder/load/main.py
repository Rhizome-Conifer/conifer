from gevent.monkey import patch_all; patch_all()

from pywb.webagg.handlers import DefaultResourceHandler, HandlerSeq, ResourceHandler
from pywb.webagg.responseloader import LiveWebLoader
from pywb.webagg.app import ResAggApp
from pywb.webagg.indexsource import LiveIndexSource, RedisIndexSource
from pywb.webagg.indexsource import MementoIndexSource, RemoteIndexSource, WAYBACK_ORIG_SUFFIX
from pywb.webagg.aggregator import SimpleAggregator, BaseRedisMultiKeyIndexSource, GeventMixin
from pywb.webagg.autoapp import init_index_source

from pywb.webagg.utils import res_template
from webrecorder.utils import load_wr_config

import os
import json


# =============================================================================
PROXY_PREFIX = ''


def make_webagg():
    config = load_wr_config()

    app = ResAggApp(debug=True)

    redis_base = os.environ['REDIS_BASE_URL'] + '/'

    rec_url = redis_base + config['cdxj_key_templ']
    coll_url = redis_base + config['cdxj_coll_key_templ']
    warc_url = redis_base + config['warc_key_templ']

    cache_proxy_url = os.environ.get('CACHE_PROXY_URL')
    global PROXY_PREFIX
    PROXY_PREFIX = cache_proxy_url

    rec_redis_source = MountMultiKeyIndexSource(timeout=20.0,
                                                redis_url=rec_url)

    redis = rec_redis_source.redis
    coll_redis_source = MountMultiKeyIndexSource(timeout=20.0,
                                                 redis_url=rec_url,
                                                 redis=redis)

    live_rec  = DefaultResourceHandler(
                    SimpleAggregator(
                        {'live': LiveIndexSource()}
                    ), warc_url, cache_proxy_url)

    replay_rec  = DefaultResourceHandler(
                    SimpleAggregator(
                        {'replay': rec_redis_source}
                    ), warc_url, cache_proxy_url)

    replay_coll = DefaultResourceHandler(
                    SimpleAggregator(
                        {'replay': coll_redis_source}
                    ), warc_url, cache_proxy_url)

    app.add_route('/live', live_rec)
    app.add_route('/replay', replay_rec)
    app.add_route('/replay-coll', replay_coll)
    app.add_route('/patch', HandlerSeq([replay_coll, live_rec]))

    return app


# ============================================================================
class AitFilterIndexSource(RemoteIndexSource):
    DEFAULT_AIT_ROOT = 'http://wayback.archive-it.org/'
    DEFAULT_AIT_QUERY = 'cdx?url={url}&filter=filename:ARCHIVEIT-(%s)-.*'

    def __init__(self, ait_coll, ait_host=None):
        ait_host = ait_host or self.DEFAULT_AIT_ROOT
        api_url = ait_host + self.DEFAULT_AIT_QUERY % ait_coll
        replay_url = ait_host + '{ait_coll}/' + WAYBACK_ORIG_SUFFIX
        self.ait_coll = ait_coll
        super(AitFilterIndexSource, self).__init__(api_url, replay_url)

    def _get_api_url(self, params):
        results = super(AitFilterIndexSource, self)._get_api_url(params)
        return PROXY_PREFIX + results

    def _set_load_url(self, cdx):
        parts = cdx.get('filename', '').split('-', 2)
        ait_coll = parts[1] if len(parts) == 3 else 'all'

        cdx[self.url_field] = self.replay_url.format(
                                 ait_coll=ait_coll,
                                 timestamp=cdx['timestamp'],
                                 url=cdx['url'])

    @classmethod
    def init_from_string(cls, value):
        # ait://coll1,coll2
        if value.startswith('ait://'):
            return cls(value[6:])

        # ait+http://path/to/ait/wayback coll1,coll2
        if value.startswith('ait+'):
            value = value[4:]
            parts = value.split(' ', 1)
            ait_host = parts[0]
            ait_coll = parts[1] if len(parts) == 2 else '*'
            return cls(ait_coll, ait_host)

    @classmethod
    def init_from_config(cls, config):
        if config['type'] != 'ait':
            return

        return cls(config['ait-colls'])


# ============================================================================
class ProxyMementoIndexSource(MementoIndexSource):
    def __init__(self, timegate_url, timemap_url, replay_url):
        timegate_url = PROXY_PREFIX + timegate_url
        timemap_url = PROXY_PREFIX + timemap_url
        super(ProxyMementoIndexSource, self).__init__(timegate_url, timemap_url, replay_url)


# ============================================================================
class MountMultiKeyIndexSource(GeventMixin, BaseRedisMultiKeyIndexSource):
    SUPPORTED_SOURCES = [AitFilterIndexSource,
                         RemoteIndexSource,
                         ProxyMementoIndexSource]

    def _get_source_for_key(self, key):
        if not key.endswith('_m'):
            return key, RedisIndexSource(None, self.redis, key)

        config = self.redis.get(key)
        if not config:
            return None, None#{'err': 'no custom config'}

        config = config.decode('utf-8')

        #config = json.loads(config.decode('utf-8'))
        index_source = init_index_source(config, source_list=self.SUPPORTED_SOURCES)
        return key, index_source


# ============================================================================
if __name__ == "__main__":
    from bottle import debug
    debug(True)

    from gevent.wsgi import WSGIServer
    server = WSGIServer(('', 8080), application)
    server.serve_forever()

