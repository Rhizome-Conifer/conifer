from gevent.monkey import patch_all; patch_all()

from pywb.webagg.handlers import DefaultResourceHandler, HandlerSeq, ResourceHandler
from pywb.webagg.responseloader import LiveWebLoader
from pywb.webagg.app import ResAggApp
from pywb.webagg.indexsource import LiveIndexSource, RedisIndexSource
from pywb.webagg.indexsource import MementoIndexSource, RemoteIndexSource
from pywb.webagg.aggregator import SimpleAggregator
from pywb.webagg.aggregator import RedisMultiKeyIndexSource, GeventTimeoutAggregator
from pywb.webagg.autoapp import init_index_source, register_source

from pywb.utils.wbexception import NotFoundException

from pywb.webagg.utils import res_template, load_config
from pywb.utils.loaders import load_yaml_config
from webrecorder.utils import load_wr_config, init_logging

import os
import json
import copy


# =============================================================================
PROXY_PREFIX = ''


def make_webagg():
    init_logging()

    config = load_wr_config()

    app = ResAggApp(debug=True)

    redis_base = os.environ['REDIS_BASE_URL'] + '/'

    rec_url = redis_base + config['cdxj_key_templ']
    coll_url = redis_base + config['cdxj_coll_key_templ']
    warc_url = redis_base + config['warc_key_templ']
    rec_list_key = config['rec_list_key_templ']

    cache_proxy_url = os.environ.get('CACHE_PROXY_URL', '')
    global PROXY_PREFIX
    PROXY_PREFIX = cache_proxy_url

    timeout = 20.0

    register_source(ProxyMementoIndexSource)
    #register_source(ProxyRemoteIndexSource)

    rec_redis_source = RedisMultiKeyIndexSource(timeout=timeout,
                                                redis_url=rec_url)

    redis = rec_redis_source.redis
    coll_redis_source = RedisMultiKeyIndexSource(timeout=timeout,
                                                 redis_url=coll_url,
                                                 redis=redis,
                                                 member_key_templ=rec_list_key)

    live_rec = DefaultResourceHandler(
                    SimpleAggregator(
                        {'live': LiveIndexSource()},
                    ), warc_url, cache_proxy_url)

    archives = load_remote_archives()

    # Extract Source
    extractor = GeventTimeoutAggregator(archives, timeout=timeout)
    extract_primary = DefaultResourceHandler(
                        extractor,
                        warc_url,
                        cache_proxy_url)

    extractor2 = GeventTimeoutAggregator(archives, timeout=timeout, invert_sources=True)
    extract_other = DefaultResourceHandler(
                        extractor2,
                        warc_url,
                        cache_proxy_url)

    # Patch (all + live)
    archives_live = copy.copy(archives)
    archives_live['live'] = LiveIndexSource()
    patcher = GeventTimeoutAggregator(archives_live, timeout=timeout)
    patch_rec = DefaultResourceHandler(
                     patcher,
                     warc_url,
                     cache_proxy_url)

    # Single Rec Replay
    replay_rec = DefaultResourceHandler(rec_redis_source, warc_url, cache_proxy_url)

    # Coll Replay
    replay_coll = DefaultResourceHandler(coll_redis_source, warc_url, cache_proxy_url)

    app.add_route('/live', live_rec)
    app.add_route('/extract', HandlerSeq([extract_primary, extract_other]))
    app.add_route('/replay', replay_rec)
    app.add_route('/replay-coll', replay_coll)
    app.add_route('/patch', HandlerSeq([replay_coll, patch_rec]))

    return app


# ============================================================================
def load_remote_archives():
    archive_config = load_yaml_config('pkg://webrecorder/config/archives.yaml')
    archive_config = archive_config.get('archives')

    archives = {}

    for name, archive in archive_config.items():
        source = init_index_source(archive)
        archives[name] = source

    return archives


# ============================================================================
class ProxyMementoIndexSource(MementoIndexSource):
    def __init__(self, timegate_url, timemap_url, replay_url):
        timegate_url = PROXY_PREFIX + timegate_url
        timemap_url = PROXY_PREFIX + timemap_url
        #replay_url = PROXY_PREFIX + replay_url

        super(ProxyMementoIndexSource, self).__init__(timegate_url, timemap_url, replay_url)


# ============================================================================
class ProxyRemoteIndexSource(RemoteIndexSource):
    def __init__(self, api_url, replay_url, **kwargs):
        api_url = PROXY_PREFIX + api_url
        #replay_url = PROXY_PREFIX + replay_url

        super(ProxyRemoteIndexSource, self).__init__(api_url, replay_url, **kwargs)


# ============================================================================
if __name__ == "__main__":
    from bottle import debug
    debug(True)

    from gevent.wsgi import WSGIServer
    server = WSGIServer(('', 8080), application)
    server.serve_forever()

