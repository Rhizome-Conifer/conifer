from gevent.monkey import patch_all; patch_all()

from pywb.webagg.handlers import DefaultResourceHandler, HandlerSeq
from pywb.webagg.app import ResAggApp
from pywb.webagg.indexsource import LiveIndexSource, RedisIndexSource
from pywb.webagg.aggregator import SimpleAggregator, RedisMultiKeyIndexSource

from pywb.webagg.utils import load_config

import os

# =============================================================================
def make_webagg():
    config = load_config('WR_CONFIG', './wr.yaml', 'WR_USER_CONFIG', '')

    app = ResAggApp(debug=True)

    redis_base = os.environ['REDIS_BASE_URL'] + '/'

    rec_url = redis_base + config['cdxj_key_templ']
    coll_url = redis_base + config['cdxj_coll_key_templ']
    warc_url = redis_base + config['warc_key_templ']


    live_rec  = DefaultResourceHandler(
                    SimpleAggregator(
                        {'live': LiveIndexSource()}
                    ), warc_url)

    replay_rec  = DefaultResourceHandler(
                    SimpleAggregator(
                        {'replay': RedisIndexSource(rec_url)}
                    ), warc_url)

    replay_coll = DefaultResourceHandler(
                    SimpleAggregator(
                        {'replay': RedisMultiKeyIndexSource(coll_url)}
                    ), warc_url)


    app.add_route('/live', live_rec)
    app.add_route('/replay', replay_rec)
    app.add_route('/replay-coll', replay_coll)
    app.add_route('/patch', HandlerSeq([replay_coll, live_rec]))

    return app


if __name__ == "__main__":
    from bottle import debug
    debug(True)

    from gevent.wsgi import WSGIServer
    server = WSGIServer(('', 8080), application)
    server.serve_forever()

