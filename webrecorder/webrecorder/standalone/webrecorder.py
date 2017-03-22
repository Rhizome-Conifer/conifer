import os
from webrecorder.standalone.standalone import StandaloneRunner


# ============================================================================
class WebrecorderRunner(StandaloneRunner):
    def __init__(self, argres):
        super(WebrecorderRunner, self).__init__(warcs_dir=argres.warcs_dir,
                                                redis_db=argres.db,
                                                app_port=argres.port,
                                                debug=argres.debug)
        if not argres.no_browser:
            import webbrowser
            webbrowser.open_new(os.environ['APP_HOST'] + '/')

  #  def _patch_redis(self, redis_db):
  #      from webrecorder.standalone.hiconn import patch_from_url
  #      patch_from_url(redis_db)

    def init_env(self):
        super(WebrecorderRunner, self).init_env()
        os.environ['WR_USER_CONFIG'] = 'pkg://webrecorder/config/standalone_recorder.yaml'

    @classmethod
    def add_args(cls, parser):
        parser.add_argument('-w', '--warcs-dir',
                            default='./data/warcs/',
                            help='WARC Output Root Dir')

        parser.add_argument('--db',
                            default='./data/wr.rld',
                            help='WR Database file')


# ============================================================================
webrecorder = WebrecorderRunner.main


if __name__ == "__main__":
    webrecorder()

