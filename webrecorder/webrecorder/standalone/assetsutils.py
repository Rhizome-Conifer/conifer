import os
from webassets.script import GenericArgparseImplementation
from pywb.rewrite.templateview import PkgResResolver

from webassets import Bundle
from webassets.ext.jinja2 import AssetsExtension
from webassets.bundle import wrap
from webassets.loaders import YAMLLoader


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
def build_all(assets_path):
    argv = ['-c', assets_path, 'build']

    PkgSupportParser().main(argv)


# ==================================================================
def build_if_needed(assets_path):
    env = YAMLLoader(assets_path).load_environment()
    env.resolver = PkgResResolver()

    for bundle in env:
        if env.updater.needs_rebuild(bundle, env):
            print('Updating {0}'.format(bundle.output))
            bundle.urls()


# ==================================================================
def patch_bundle():
    AssetsExtension.BundleClass = FixedBundle


# ==================================================================
def default_build(force_build=True):
    curr_path = os.path.dirname(__file__)
    assets_path = os.path.abspath(os.path.join(curr_path, '..', 'config', 'assets.yaml'))

    if force_build:
        build_all(assets_path)
    else:
        build_if_needed(assets_path)


# ==================================================================
if __name__ == "__main__":
    default_build()
