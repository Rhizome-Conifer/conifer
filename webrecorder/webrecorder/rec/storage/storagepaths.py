FULL_WARC_PREFIX = 'http://nginx:6090'

def init_props(config):
    global FULL_WARC_PREFIX
    FULL_WARC_PREFIX = config['full_warc_prefix']

def strip_prefix(uri):
    if FULL_WARC_PREFIX and uri.startswith(FULL_WARC_PREFIX):
        return uri[len(FULL_WARC_PREFIX):]

    return uri

def add_local_store_prefix(uri):
    return FULL_WARC_PREFIX + uri

