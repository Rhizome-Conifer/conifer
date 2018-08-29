from gevent.monkey import patch_all; patch_all()

from pywb.warcserver.index.indexsource import LiveIndexSource, RedisIndexSource
from pywb.warcserver.index.indexsource import MementoIndexSource, WBMementoIndexSource, RemoteIndexSource
from pywb.warcserver.index.aggregator import SimpleAggregator, GeventTimeoutAggregator

from pywb.warcserver.resource.responseloader import LiveWebLoader
from pywb.warcserver.resource.pathresolvers import RedisResolver

from pywb.warcserver.handlers import DefaultResourceHandler, HandlerSeq, ResourceHandler
from pywb.warcserver.warcserver import BaseWarcServer, init_index_source, register_source

from pywb.utils.wbexception import NotFoundException
from pywb.utils.loaders import load_yaml_config

from webrecorder.utils import load_wr_config, init_logging

from webrecorder.load.wamsourceloader import WAMSourceLoader

from webrecorder.models import Recording, Collection

import os
import json


# =============================================================================
PROXY_PREFIX = ''


class WRWarcServer(object):
    def __init__(self):
        init_logging()

        config = load_wr_config()

        app = BaseWarcServer(debug=True)

        redis_base = os.environ['REDIS_BASE_URL'] + '/'

        #rec_url = redis_base + config['cdxj_key_templ']
        #coll_url = redis_base + config['coll_cdxj_key_templ']
        #warc_url = redis_base + config['coll_warc_key_templ']
        #rec_map_key = config['rec_map_key_templ']
        rec_url = redis_base + Recording.CDXJ_KEY
        coll_url = redis_base + Collection.COLL_CDXJ_KEY
        warc_url = redis_base + Recording.COLL_WARC_KEY
        rec_map_key = Collection.RECS_KEY


        redis_resolver = RedisResolver(redis_url=warc_url,
                                       member_key_templ=rec_map_key)
        redis = redis_resolver.redis
        warc_resolvers = [redis_resolver]

        cache_proxy_url = os.environ.get('CACHE_PROXY_URL', '')
        global PROXY_PREFIX
        PROXY_PREFIX = cache_proxy_url

        timeout = 20.0

        rec_redis_source = RedisIndexSource(timeout=timeout,
                                            redis_url=rec_url,
                                            redis=redis)

        coll_redis_source = RedisIndexSource(timeout=timeout,
                                             redis_url=coll_url,
                                             redis=redis)

        live_rec = DefaultResourceHandler(
                        SimpleAggregator(
                            {'live': LiveIndexSource()},
                        ), warc_resolvers,
                        cache_proxy_url)

        # Extractable archives (all available)
        wam_loader = WAMSourceLoader(memento_cls=ProxyMementoIndexSource,
                                     remote_cls=ProxyRemoteIndexSource,
                                     wb_memento_cls=ProxyWBMementoIndexSource)

        extractable_archives = wam_loader.sources

        # Extract Source
        extractor = GeventTimeoutAggregator(extractable_archives, timeout=timeout)
        extract_primary = DefaultResourceHandler(
                            extractor,
                            warc_resolvers,
                            cache_proxy_url)

        # Patch fallback archives
        fallback_archives = self.filter_archives(extractable_archives,
                                                 config['patch_archives_index'])

        # patch + live
        #patch_archives = fallback_archives.copy()
        patch_archives = fallback_archives
        patch_archives['live'] = LiveIndexSource()

        extractor2 = GeventTimeoutAggregator(patch_archives, timeout=timeout,
                                             sources_key='inv_sources',
                                             invert_sources=True)

        extract_other = DefaultResourceHandler(
                            extractor2,
                            warc_resolvers,
                            cache_proxy_url)

        patcher = GeventTimeoutAggregator(patch_archives, timeout=timeout)
        patch_rec = DefaultResourceHandler(
                         patcher,
                         warc_resolvers,
                         cache_proxy_url)

        # Single Rec Replay
        replay_rec = DefaultResourceHandler(SimpleAggregator({'local': rec_redis_source}),
                                            warc_resolvers,
                                            cache_proxy_url)

        # Coll Replay
        replay_coll = DefaultResourceHandler(SimpleAggregator({'local': coll_redis_source}),
                                             warc_resolvers,
                                             cache_proxy_url)

        app.add_route('/live', live_rec)
        app.add_route('/extract', HandlerSeq([extract_primary, extract_other, replay_rec]))
        app.add_route('/replay', replay_rec)
        app.add_route('/replay-coll', replay_coll)
        app.add_route('/patch', HandlerSeq([replay_coll, patch_rec]))

        self.app = app

    def filter_archives(self, archives, patch_archives_index):
        patch_archives = {}
        if not patch_archives_index:
            return patch_archives

        filter_list = load_yaml_config(patch_archives_index)
        filter_list = filter_list.get('webarchive_ids', {})

        for name in archives.keys():
            if name in filter_list:
                patch_archives[name] = archives[name]

        return patch_archives


# ============================================================================
class ProxyMementoIndexSource(MementoIndexSource):
    def __init__(self, timegate_url, timemap_url, replay_url):
        timegate_url = PROXY_PREFIX + timegate_url
        timemap_url = PROXY_PREFIX + timemap_url

        super(ProxyMementoIndexSource, self).__init__(timegate_url, timemap_url, replay_url)


# ============================================================================
class ProxyWBMementoIndexSource(WBMementoIndexSource):
    def __init__(self, timegate_url, timemap_url, replay_url):
        timegate_url = PROXY_PREFIX + timegate_url
        timemap_url = PROXY_PREFIX + timemap_url

        super(ProxyWBMementoIndexSource, self).__init__(timegate_url, timemap_url, replay_url)


# ============================================================================
class ProxyRemoteIndexSource(RemoteIndexSource):
    def __init__(self, api_url, replay_url, **kwargs):
        api_url = PROXY_PREFIX + api_url

        super(ProxyRemoteIndexSource, self).__init__(api_url, replay_url, **kwargs)


# ============================================================================
if __name__ == "__main__":
    from bottle import debug
    debug(True)

    from gevent.wsgi import WSGIServer
    server = WSGIServer(('', 8080), application)
    server.serve_forever()

