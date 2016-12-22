from pywb.webagg.utils import load_config

def load_wr_config():
    return load_config('WR_CONFIG', 'pkg://webrecorder/config/wr.yaml', 'WR_USER_CONFIG', '')

