import gevent
import base64
import os

from webrecorder.standalone.standalone import StandaloneRunner
from webrecorder.rec.webrecrecorder import WebRecRecorder
from webrecorder.uploadcontroller import InplaceLoader
from webrecorder.redisman import init_manager_for_cli
from webrecorder.admin import create_user

from gevent.threadpool import ThreadPool


# ============================================================================
class WebrecPlayerRunner(StandaloneRunner):
    ARCHIVE_EXT = ('.warc', '.arc', '.warc.gz', '.arc.gz', '.warcgz', '.arcgz', '.har')

    def __init__(self, argres):
        self.inputs = argres.inputs

        super(WebrecPlayerRunner, self).__init__(app_port=argres.port,
                                                 rec_port=-1,
                                                 debug=argres.debug)

        if not argres.no_browser:
            import webbrowser
            webbrowser.open_new(os.environ['APP_HOST'] + '/')

    def admin_init(self):
        pool = ThreadPool(maxsize=1)
        pool.spawn(self.safe_auto_load_warcs)

    def safe_auto_load_warcs(self):
        try:
            self.auto_load_warcs()
        except:
            print('Initial Load Failed!')
            import traceback
            traceback.print_exc()

    def auto_load_warcs(self):
        manager = init_manager_for_cli()

        create_user(manager,
                    email='test@localhost',
                    username='local',
                    passwd='LocalUser1',
                    role='public-archivist',
                    name='local')

        indexer = WebRecRecorder.make_wr_indexer(manager.config)

        uploader = InplaceLoader(manager, indexer, '@INIT')

        files = list(self.get_archive_files(self.inputs))

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
        parser.add_argument('inputs', nargs='*',
                            help='web archive (.warc.gz, .warc, .arc.gz, .arc or .har files)')



# ============================================================================
webrecorder_player = WebrecPlayerRunner.main


if __name__ == "__main__":
    webrecorder_player()

