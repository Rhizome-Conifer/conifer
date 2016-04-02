from gevent.monkey import patch_all; patch_all()

from webagg.handlers import DefaultResourceHandler
from webagg.app import ResAggApp
from webagg.indexsource import LiveIndexSource, RedisIndexSource
from webagg.aggregator import SimpleAggregator, RedisMultiKeyIndexSource

import os
from pywb.utils.loaders import load_yaml_config


# ============================================================================
def make_webagg():
    config = load_yaml_config(os.environ.get('WR_CONFIG', './wr.yaml'))

    app = ResAggApp()

    redis_base = os.environ['REDIS_BASE_URL'] + '/'

    cdxj_key_templ = config['cdxj_key_templ']
    cdxj_coll_key_templ = config['cdxj_coll_key_templ']
    warc_key_templ = config['warc_key_templ']


    app.add_route('/live',
        DefaultResourceHandler(SimpleAggregator(
                               {'live': LiveIndexSource()})
        )
    )

    app.add_route('/replay',
        DefaultResourceHandler(SimpleAggregator(
                               {'replay': RedisIndexSource(redis_base + cdxj_key_templ)}),
                                redis_base + warc_key_templ
        )
    )

    app.add_route('/replay-coll',
        DefaultResourceHandler(SimpleAggregator(
                               {'replay': RedisMultiKeyIndexSource(redis_base + cdxj_coll_key_templ)}),
                                redis_base + warc_key_templ
        )
    )

    return app.application



application = make_webagg()

import bottle
bottle.debug = True

if __name__ == "__main__":
    from gevent.wsgi import WSGIServer
    server = WSGIServer(('', 8080), application)
    server.serve_forever()

