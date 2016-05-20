from webagg.utils import StreamIter
from pywb.utils.timeutils import timestamp_now
from webrecorder.basecontroller import BaseController

import requests
from bottle import response
from six.moves.urllib.parse import quote


# ============================================================================
class DownloadController(BaseController):
    def __init__(self, app, jinja_env, manager, config):
        super(DownloadController, self).__init__(app, jinja_env, manager, config)
        self.paths = config['url_templates']
        self.download_filename = config['download_paths']['filename']

    def init_routes(self):
        @self.app.get('/<user>/<coll>/<rec>/$download')
        def logged_in_download_rec_warc(user, coll, rec):

            return self.handle_download('rec', user, coll, rec)

        @self.app.get('/<user>/<coll>/$download')
        def logged_in_download_coll_warc(user, coll):
            return self.handle_download('coll', user, coll, '*')

    def handle_download(self, type, user, coll, rec):
        info = {}
        rec_title = ''
        coll_title = ''

        if rec == '*':
            info = self.manager.get_collection(user, coll)
            if not info:
                self._raise_error(404, 'Collection not found',
                                  id=coll)

            title = coll_title = info.get('title', coll)

        else:
            info = self.manager.get_recording(user, coll, rec)
            if not info:
                self._raise_error(404, 'Collection not found',
                                  id=coll)

            title = rec_title = info.get('title', rec)

        now = timestamp_now()
        filename = self.download_filename.format(title=title,
                                                 timestamp=now)

        download_url = self.paths['download']
        download_url = download_url.format(record_host=self.record_host,
                                           user=user,
                                           coll=coll,
                                           rec=rec,
                                           type=type,
                                           filename=filename,
                                           rec_title=rec_title,
                                           coll_title=coll_title)

        res = requests.get(download_url, stream=True)

        if res.status_code >= 400:
            try:
                res.raw.close()
            except:
                pass

            self._raise_error(400, 'Unable to download WARC')

        response.headers['Content-Type'] = 'application/octet-stream'
        response.headers['Content-Disposition'] = 'attachment; filename=' + quote(filename)

        length = res.headers.get('Content-Length')
        if length:
            response.headers['Content-Length'] = length

        encoding = res.headers.get('Transfer-Encoding')
        if encoding:
            response.headers['Transfer-Encoding'] = encoding

        return StreamIter(res.raw)


