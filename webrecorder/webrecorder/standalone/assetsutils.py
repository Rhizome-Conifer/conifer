import os
from webassets.script import GenericArgparseImplementation
from pywb.urlrewrite.templateview import PkgResResolver

from webassets import Bundle
from webassets.ext.jinja2 import AssetsExtension
from webassets.bundle import wrap


# ==================================================================
# custom PkgResolver with pkg://
class PkgSupportParser(GenericArgparseImplementation):
    def _setup_assets_env(self, ns, log):
        env = super(PkgSupportParser, self)._setup_assets_env(ns, log)
        env.resolver = PkgResResolver()
        return env


# ==================================================================
class FixedBundle(Bundle):
    def urls(self, *a, **kw):
        ctx = wrap(self.env, self)
        urls = []
        for bundle, extra_filters, new_ctx in self.iterbuild(ctx):
            urls.append(ctx.url + bundle.output)

        return urls


# ==================================================================
def build(assets_path):
    argv = ['-c', assets_path, 'build']

    PkgSupportParser().main(argv)


# ==================================================================
def patch_bundle():
    AssetsExtension.BundleClass = FixedBundle


def default_build():
    curr_path = os.path.dirname(__file__)
    assets_path = os.path.abspath(os.path.join(curr_path, '..', 'config', 'assets.yaml'))
    build(assets_path)


# =================================================================
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


def get_version_str():
    return '%s {0}\npywb {1}'.format(get_pkg_version('webrecorder'),
                                     get_pkg_version('pywb'))


# ==================================================================
if __name__ == "__main__":
    default_build()
