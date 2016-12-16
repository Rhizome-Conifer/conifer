from PyInstaller.utils.hooks import collect_data_files
import os

from webassets.script import GenericArgparseImplementation
from pywb.urlrewrite.templateview import PkgResResolver

# custom PkgResolver with pkg://
class PkgSupportParser(GenericArgparseImplementation):
    def _setup_assets_env(self, ns, log):
        env = super(PkgSupportParser, self)._setup_assets_env(ns, log)
        env.resolver = PkgResResolver()
        return env


def build_package(datas, name, dest, src, recurse=False):
    datas.append((os.path.abspath('../webrecorder/__init__.py'), name))

    if recurse:
        for root, dirs, files in os.walk(src):
            rel_path = os.path.relpath(root, src)
            rel_path = os.path.join(dest, rel_path)

            dirs[:] = [d for d in dirs if not d.startswith('.')]

            for filename in files:
                if filename.startswith('.'):
                    continue

                full = os.path.join(root, filename)
                datas.append((os.path.abspath(full), rel_path))

    else:
        for filename in os.listdir(src):
            full = os.path.join(src, filename)
            datas.append((full, dest))

datas = []

# build webassets bundles
PkgSupportParser().main(['-c', '../assets.yaml', 'build'])


build_package(datas, 'wrtemp', 'wrtemp/templates', '../templates/')
build_package(datas, 'static', 'static', '../static/', True)

datas.append((os.path.abspath('./wr_local.env'), 'config'))

datas.append((os.path.abspath('../assets.yaml'), 'config'))

datas.append((os.path.abspath('../../wr.yaml'), 'config'))
datas.append((os.path.abspath('./player_config.yaml'), 'config'))


