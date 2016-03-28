from gevent import monkey; monkey.patch_all()

import os
from six.moves.urllib.parse import quote

from bottle import Bottle, request, redirect, debug, abort

from rewriterapp import RewriterApp


# ============================================================================
class WebRecApp(RewriterApp):
    DEF_REC_NAME = 'my_recording'

    PATHS = {'live': '{replay_host}/live/resource/postreq?url={url}&closest={closest}',
             'record': '{record_host}/record/live/resource/postreq?url={url}&closest={closest}&param.recorder.user={user}&param.recorder.coll={coll}&param.recorder.rec={rec}',
             'replay': '{replay_host}/replay/resource/postreq?url={url}&closest={closest}&param.replay.user={user}&param.replay.coll={coll}&param.replay.rec={rec}',
             'replay_coll': '{replay_host}/replay-coll/resource/postreq?url={url}&closest={closest}&param.user={user}&param.coll={coll}'
            }

    def __init__(self):
        super(WebRecApp, self).__init__(True)

        self.app = Bottle()
        debug(True)

        self.record_host = os.environ.get('RECORD_HOST', 'http://localhost:8010')
        self.replay_host = os.environ.get('REPLAY_HOST', 'http://localhost:8080')

        self.init_routes()

    def init_routes(self):
        @self.app.route(['/record/<wb_url:re:.*>', '/anonymous/record/<wb_url:re:.*>'])
        def redir_anon_rec(wb_url):
            new_url = '/anonymous/{rec}/record/{url}'.format(rec=self.DEF_REC_NAME,
                                                             url=wb_url)
            return redirect(new_url)

        @self.app.route(['/replay/<wb_url:re:.*>'])
        def redir_anon_replay(wb_url):
            new_url = '/anonymous/{url}'.format(url=wb_url)
            return redirect(new_url)

        # LIVE DEBUG
        @self.app.route('/live/<wb_url:re:.*>')
        def live(wb_url):
            request.path_shift(1)

            return self.render_anon_content(wb_url, rec='', type='live')

        # ANON ROUTES
        @self.app.route('/anonymous/<rec_name>/record/<wb_url:re:.*>')
        def anon_record(rec_name, wb_url):
            request.path_shift(3)

            return self.render_anon_content(wb_url, rec=rec_name, type='record')

        @self.app.route('/anonymous/<wb_url:re:(https?\:\/\/|\*|\d+).*>')
        def anon_replay_coll(wb_url):
            request.path_shift(1)

            return self.render_anon_content(wb_url, rec='*', type='replay')

        @self.app.route('/anonymous/<rec_name>/<wb_url:re:.*>')
        def anon_replay(rec_name, wb_url):
            request.path_shift(2)

            return self.render_anon_content(wb_url, rec=rec_name, type='replay')

        #@self.app.route('/static/<filename:path>')
        #def serve_static(filename):
        #    return static_file(filename, root='/path/to/static/files')

        @self.app.error(404)
        def not_found(error):
            if isinstance(error.exception, dict):
                msg = 'The url <b>{url}</b> was not found in the archive'
                msg = msg.format(url=error.exception['url'])
            else:
                msg = 'Url Not Found'

            return msg


    def render_anon_content(self, wb_url, rec, type):
        user = 'anon'
        coll = 'anonymous'
        return self.render_content(wb_url, user=user,
                                           coll=coll,
                                           rec=rec,
                                           type=type)

    def get_upstream_url(self, url, closest, kwargs):
        type = kwargs['type']
        upstream_url = self.PATHS[type].format(url=quote(url),
                                               closest=closest,
                                               record_host=self.record_host,
                                               replay_host=self.replay_host,
                                               **kwargs)

        return upstream_url

    def _add_custom_params(self, cdx, kwargs):
        type = kwargs['type']
        if type in ('live', 'record'):
            cdx['is_live'] = 'true'


# ============================================================================
application = WebRecApp().app


