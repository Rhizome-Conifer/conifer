import gevent
import base64
import os

from webrecorder.standalone.standalone import StandaloneRunner
from webrecorder.rec.webrecrecorder import WebRecRecorder
from webrecorder.uploadcontroller import InplaceUploader
from webrecorder.redisman import init_manager_for_cli


# ============================================================================
class WebrecPlayerRunner(StandaloneRunner):
    ARCHIVE_EXT = ('.warc', '.arc', '.warc.gz', '.arc.gz', '.warcgz', '.arcgz')

    def __init__(self, argres):
        super(WebrecPlayerRunner, self).__init__(app_port=argres.port,
                                                 rec_port=-1,
                                                 debug=argres.debug)

        if not argres.no_browser:
            import webbrowser
            webbrowser.open_new(os.environ['APP_HOST'] + '/')

        gevent.spawn(self.auto_load_warcs, argres)

    def auto_load_warcs(self, argres):
        manager = init_manager_for_cli()

        indexer = WebRecRecorder.make_wr_indexer(manager.config)

        uploader = InplaceUploader(manager, indexer, '@INIT')

        files = list(self.get_archive_files(argres.inputs))

        uploader.multifile_upload('local', files)

    def init_env(self):
        super(WebrecPlayerRunner, self).init_env()
        os.environ['WR_USER_CONFIG'] = 'pkg://webrecorder/config/standalone_player.yaml'
        os.environ['SECRET_KEY'] = base64.b32encode(os.urandom(75)).decode('utf-8')

    def get_archive_files(self, inputs, prefix=''):
        for filename in inputs:
            if prefix:
                filename = os.path.join(prefix, filename)

            if os.path.isfile(filename) and filename.endswith(self.ARCHIVE_EXT):
                yield filename

            if os.path.isdir(filename):
                for root, dirs, files in os.walk(filename):
                    for filename_ in self.get_archive_files(files, root):
                        yield filename_

    @classmethod
    def add_args(cls, parser):
        parser.add_argument('inputs', nargs='+')



# ============================================================================
webrecorder_player = WebrecPlayerRunner.main


if __name__ == "__main__":
    webrecorder_player()

