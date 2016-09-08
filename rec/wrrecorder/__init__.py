import os

__version__ = '3.1'


# ============================================================================
def get_shared_config_root():
    return os.path.dirname(os.path.dirname(os.path.dirname(os.path.realpath(__file__)))) + os.path.sep


