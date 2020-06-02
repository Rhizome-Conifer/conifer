from PyInstaller.utils.hooks import collect_data_files, copy_metadata, collect_submodules
import os

from webrecorder.standalone.assetsutils import build_all
from webrecorder.standalone.versionbuild import get_version_str

def rename(old, new, t):
    return [(n, v.replace(old, new)) for n, v in t]


# Build webassets bundle
curr_path = os.path.dirname(__file__)
assets_path = os.path.abspath(os.path.join(curr_path, '..', '..', 'config', 'assets.yaml'))
build_all(assets_path)

datas = []

# special package to put templates into to allow pyinstaller pkg_resources to find them
temp_pkg = 'wrtemp'

# move templates to separate 'wrtemp' package (only for bundled apps) to avoid
# issue with loading
init_py_path = os.path.abspath(os.path.join(curr_path, '..', '..', '__init__.py'))

datas.append((init_py_path, temp_pkg))

datas += rename('webrecorder' + os.path.sep,
                temp_pkg + os.path.sep,
                collect_data_files('webrecorder', subdir='templates'))

datas += collect_data_files('webrecorder', subdir='static')
datas += collect_data_files('webrecorder', subdir='config')

# generate full version
full_version_path = os.path.abspath(os.path.join(curr_path, '..', '..', 'config', '_full_version'))
with open(full_version_path, 'wt') as fh:
    fh.write(get_version_str())
    fh.flush()

datas.append((full_version_path, 'webrecorder/config'))



datas += copy_metadata('bottle')

hiddenimports = ['webrecorder.git_hash',
                 'pywb.git_hash',
                 'brotli',
                 'configparser',
                 '_cffi_backend']

hiddenimports.extend(collect_submodules('pkg_resources'))
