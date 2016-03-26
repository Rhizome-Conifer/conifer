from gevent.monkey import patch_all; patch_all()

from webagg.handlers import DefaultResourceHandler
from webagg.app import ResAggApp
from webagg.indexsource import LiveIndexSource, RedisIndexSource
from webagg.aggregator import SimpleAggregator, RedisMultiKeyIndexSource

import os

def make_webagg():
    app = ResAggApp()

    redis_base = os.environ.get('REDIS_BASE_URL', 'redis://localhost/1/')
    print('REDIS: ' + redis_base)

    app.add_route('/live',
        DefaultResourceHandler(SimpleAggregator(
                               {'live': LiveIndexSource()})
        )
    )

    app.add_route('/replay',
        DefaultResourceHandler(SimpleAggregator(
                               {'replay': RedisIndexSource(redis_base + '{user}:{coll}:{rec}:cdxj')}),
                                redis_base + '{user}:{coll}:warc'
        )
    )

    app.add_route('/replay-coll',
        DefaultResourceHandler(SimpleAggregator(
                               {'replay': RedisMultiKeyIndexSource(redis_base + '{user}:{coll}:*:cdxj')}),
                                redis_base + '{user}:{coll}:warc'
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

