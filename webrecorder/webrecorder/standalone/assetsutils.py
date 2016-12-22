import os
from webassets.script import GenericArgparseImplementation
from pywb.urlrewrite.templateview import PkgResResolver

from webassets import Bundle
from webassets.ext.jinja2 import AssetsExtension


# ==================================================================
# custom PkgResolver with pkg://
class PkgSupportParser(GenericArgparseImplementation):
    def _setup_assets_env(self, ns, log):
        env = super(PkgSupportParser, self)._setup_assets_env(ns, log)
        env.resolver = PkgResResolver()
        return env


# ==================================================================
class FixedBundle(Bundle):
    def __init__(self, *a, **kw):
        super(FixedBundle, self).__init__(*a, **kw)
        self.output_file = a[0].output

    def urls(self, *a, **kw):
        return ['/static/__shared/' + self.output_file]

    def _set_filters(self, value):
        self._filters = ()


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


# ==================================================================
if __name__ == "__main__":
    default_build()
