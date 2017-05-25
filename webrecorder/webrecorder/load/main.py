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

    patch_ra_key = config['patch_ra_key']

    cache_proxy_url = os.environ.get('CACHE_PROXY_URL')
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
    extract_rec = DefaultResourceHandler(
                     extractor,
                     warc_url,
                     cache_proxy_url)

    # Patch (all + live)
    archives_live = copy.copy(archives)
    archives_live['live'] = LiveIndexSource()
    patcher = PatchAllFilterAggregator(archives_live, timeout=timeout)
    patch_rec = DefaultResourceHandler(
                     patcher,
                     warc_url,
                     cache_proxy_url)


    # Single Rec Replay
    replay_rec = DefaultResourceHandler(
                    SimpleAggregator(
                        {'replay': rec_redis_source}
                    ), warc_url, cache_proxy_url)


    # Remote Replay Source
    replay_remote_agg = RedisSourceFilterAggregator(archives,
                                                    redis=redis,
                                                    source_key=patch_ra_key,
                                                    timeout=timeout)

    remote_replay = DefaultResourceHandler(replay_remote_agg, warc_url, cache_proxy_url)

    # Coll Replay
    replay_coll = DefaultResourceHandler(coll_redis_source, warc_url, cache_proxy_url)

    app.add_route('/live', live_rec)
    app.add_route('/extract', extract_rec)
    app.add_route('/replay', replay_rec)
    app.add_route('/replay-coll', HandlerSeq([replay_coll, remote_replay]))
    app.add_route('/patch', HandlerSeq([replay_coll, remote_replay, patch_rec]))

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
class RedisSourceFilterAggregator(GeventTimeoutAggregator):
    def __init__(self, sources, **kwargs):
        super(RedisSourceFilterAggregator, self).__init__(sources, **kwargs)
        self.redis = kwargs['redis']
        self.source_key_templ = kwargs['source_key']

    def _iter_sources(self, params):
        if not params.get('sources'):
            source_key = res_template(self.source_key_templ, params)
            remote_sources = self.redis.hgetall(source_key)

            if not remote_sources:
                return []

            source_list = [name.decode('utf-8')
                           for name, count in remote_sources.items()
                           if int(count) > 0]

            if not source_list:
                return []

            params['sources'] = ','.join(source_list)

        # don't record here
        params['recorder_skip'] = '1'
        return super(RedisSourceFilterAggregator, self)._iter_sources(params)


# ============================================================================
class PatchAllFilterAggregator(GeventTimeoutAggregator):
    def _iter_sources(self, params):
        replay_sources = params.get('sources')

        # allow recording
        params.pop('recorder_skip')

        # if no replay source list or all list
        # then patch from 'live' only
        if not replay_sources or replay_sources == '*':
            yield ('live', self.sources['live'])
            return

        # else patch from every archive *not* in the sources list!
        replay_list = replay_sources.split(',')
        for name in self.sources.keys():
            if name not in replay_list:
                yield name, self.sources[name]


# ============================================================================
if __name__ == "__main__":
    from bottle import debug
    debug(True)

    from gevent.wsgi import WSGIServer
    server = WSGIServer(('', 8080), application)
    server.serve_forever()

