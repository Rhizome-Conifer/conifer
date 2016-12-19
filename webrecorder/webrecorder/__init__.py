from pywb.webagg.utils import load_config

__version__ = '3.4'


def load_wr_config():
    return load_config('WR_CONFIG', 'pkg://webrecorder/config/wr.yaml', 'WR_USER_CONFIG', '')

