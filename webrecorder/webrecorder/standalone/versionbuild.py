import sys
import os


# ============================================================================
def get_pkg_version(pkg, attr='git_hash'):
    import pkg_resources
    version = pkg_resources.get_distribution(pkg).version

    try:
        import importlib
        git_hash = getattr(importlib.import_module(pkg + '.' + attr), attr)
    except:
        git_hash = ''

    if git_hash:
        version += ' (@{0})'.format(git_hash)

    return version


# ============================================================================
def get_version_str():
    version = """\
%s {0}
pywb {1}
har2warc {2}
warcio {3}"""

    return version.format(get_pkg_version('webrecorder'),
                          get_pkg_version('pywb'),
                          get_pkg_version('har2warc'),
                          get_pkg_version('warcio'))


# ============================================================================
def get_full_version():
    full_version = 'unknown'
    curr_app = sys.argv[0].rsplit(os.path.sep)[-1]

    try:
        # standalone app, read baked-in _full_version
        if getattr(sys, 'frozen', False):
            from pywb.utils.loaders import load
            full_version = load('pkg://webrecorder/config/_full_version').read()
            full_version = full_version.decode('utf-8').format(curr_app)
        else:
        # generate full_version dynamically
            full_version = get_version_str()
    except:
        pass

    return (full_version % curr_app)


