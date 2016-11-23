from gevent.monkey import patch_all; patch_all()

from pywb.webagg.handlers import DefaultResourceHandler, HandlerSeq, ResourceHandler
from pywb.webagg.responseloader import LiveWebLoader
from pywb.webagg.app import ResAggApp
from pywb.webagg.indexsource import LiveIndexSource, RedisIndexSource
from pywb.webagg.indexsource import MementoIndexSource, RemoteIndexSource, WAYBACK_ORIG_SUFFIX
from pywb.webagg.aggregator import SimpleAggregator, BaseRedisMultiKeyIndexSource, GeventMixin
from pywb.webagg.autoapp import init_index_source

from pywb.webagg.utils import load_config, res_template

import os
import json

# =============================================================================
def make_webagg():
    config = load_config('WR_CONFIG', './wr.yaml', 'WR_USER_CONFIG', '')

    app = ResAggApp(debug=True)

    redis_base = os.environ['REDIS_BASE_URL'] + '/'

    rec_url = redis_base + config['cdxj_key_templ']
    coll_url = redis_base + config['cdxj_coll_key_templ']
    warc_url = redis_base + config['warc_key_templ']

    rec_redis_source = RedisIndexSource(rec_url)
    redis = rec_redis_source.redis

    live_rec  = DefaultResourceHandler(
                    SimpleAggregator(
                        {'live': LiveIndexSource()}
                    ), warc_url)

    replay_rec  = DefaultResourceHandler(
                    SimpleAggregator(
                        {'replay': rec_redis_source}
                    ), warc_url)

    replay_coll = DefaultResourceHandler(
                    SimpleAggregator(
                        {'replay': MountMultiKeyIndexSource(redis_url=coll_url, redis=redis)}
                    ), warc_url)

    app.add_route('/live', live_rec)
    app.add_route('/replay', replay_rec)
    app.add_route('/replay-coll', replay_coll)
    app.add_route('/patch', HandlerSeq([replay_coll, live_rec]))

    return app


# ============================================================================
class AitFilterIndexSource(RemoteIndexSource):
    DEFAULT_AIT_ROOT = 'http://wayback.archive-it.org/'
    DEFAULT_AIT_QUERY = 'cdx?url={url}&filter=filename:ARCHIVEIT-(%s)-.*'

    def __init__(self, ait_colls, ait_host=None):
        ait_host = ait_host or self.DEFAULT_AIT_ROOT
        api_url = ait_host + self.DEFAULT_AIT_QUERY % ait_colls
        replay_url = ait_host + '{ait_coll}/' + WAYBACK_ORIG_SUFFIX
        super(AitFilterIndexSource, self).__init__(api_url, replay_url)

    def _set_load_url(self, cdx):
        parts = cdx.get('filename', '').split('-', 2)
        ait_coll = parts[1] if len(parts) == 2 else 'all'

        cdx[self.url_field] = self.replay_url.format(
                                 ait_coll=ait_coll,
                                 timestamp=cdx['timestamp'],
                                 url=cdx['url'])

        print(cdx[self.url_field])

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
            ait_colls = parts[1] if len(parts) == 2 else '*'
            return cls(ait_colls, ait_host)

    @classmethod
    def init_from_config(cls, config):
        if config['type'] != 'ait':
            return

        return cls(config['ait-colls'])


# ============================================================================
class MountMultiKeyIndexSource(GeventMixin, BaseRedisMultiKeyIndexSource):
    SUPPORTED_SOURCES = [AitFilterIndexSource,
                         RemoteIndexSource,
                         MementoIndexSource]

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

