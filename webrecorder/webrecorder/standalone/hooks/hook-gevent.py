# custom hooks for gevent 1.3
# adapted from https://github.com/pyinstaller/pyinstaller/pull/3534
# (can be removed if above PR is merged into pyinstaller)
hiddenimports = [
        'gevent.__greenlet_primitives',
        'gevent.__hub_local',
        'gevent.__hub_primitives',
        'gevent.__ident',
        'gevent.__imap',
        'gevent.__semaphore',
        'gevent.__tracer',
        'gevent.__waiter',
        'gevent._abstract_linkable',
        'gevent.__abstract_linkable',
        'gevent._event',
        'gevent._greenlet',
        'gevent._local',
        'gevent._queue',

        'gevent.os',
        'gevent.time',
        'gevent.thread',
        'gevent.socket',
        'gevent.select',
        'gevent.ssl',
        'gevent.subprocess',
        'gevent.builtins',
        'gevent.signal',

        'gevent.libev',
        'gevent.libev.corecext',
        'gevent.libev.corecffi',
        'gevent.libev.watcher',
]
