from PyInstaller.utils.hooks import collect_data_files
import os

from webrecorder.standalone.assetsutils import build

def rename(old, new, t):
    return [(n, v.replace(old, new)) for n, v in t]


# Build webassets bundle
build()

datas = []

# move templates to separate 'wrtemp' package (only for bundled apps) to avoid
# issue with loading
datas.append((os.path.abspath('../__init__.py'), 'wrtemp'))
datas += rename('webrecorder/', 'wrtemp/', collect_data_files('webrecorder', subdir='templates'))

datas += collect_data_files('webrecorder', subdir='static')
datas += collect_data_files('webrecorder', subdir='config')

