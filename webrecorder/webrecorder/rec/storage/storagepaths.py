FULL_WARC_PREFIX = 'http://nginx:6090'

def init_props(config):
    """Initialize module-level variables.

    :param dict config: Webrecorder configuration
    """
    global FULL_WARC_PREFIX
    FULL_WARC_PREFIX = config['full_warc_prefix']

def strip_prefix(uri):
    """Get path from URI.

    :param str uri: URI

    :returns: URI w/o WARC network location
    :rtype: str
    """
    if FULL_WARC_PREFIX and uri.startswith(FULL_WARC_PREFIX):
        return uri[len(FULL_WARC_PREFIX):]

    return uri

def add_local_store_prefix(uri):
    """Add network location to URI.

    :param str uri: URI

    :returns: URI w/ WARC network location prefix
    :rtype: str
    """
    return FULL_WARC_PREFIX + uri

