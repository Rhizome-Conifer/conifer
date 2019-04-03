import requests
from io import BytesIO
from six.moves.urllib.parse import quote

from bottle import response, request

from webrecorder.basecontroller import BaseController
from webrecorder.unrewriter import HTMLDomUnRewriter, UnRewriter, NopRewriter

from warcio.timeutils import timestamp_now, iso_date_to_timestamp
from warcio.timeutils import timestamp_to_datetime, datetime_to_iso_date


# ============================================================================
class SnapshotController(BaseController):
    def __init__(self, *args, **kwargs):
        super(SnapshotController, self).__init__(*args, **kwargs)
        self.browser_mgr = kwargs['browser_mgr']
        self.content_app = kwargs['content_app']

    def init_routes(self):
        @self.app.route('/_snapshot', method='PUT')
        def snapshot():
            return self.snapshot()

        @self.app.route('/_snapshot_cont', method='POST')
        def snapshot_cont():
            return self.snapshot_cont()

    def snapshot(self):
        user, collection = self.load_user_coll()

        html_text = request.body.read().decode('utf-8')

        host = request.urlparts.scheme + '://'
        if self.content_host:
            host += self.content_host
        else:
            host += request.urlparts.netloc

        prefix = request.query.getunicode('prefix')

        url = request.query.getunicode('url')

        user_agent = request.environ.get('HTTP_USER_AGENT')

        title = request.query.getunicode('title')

        unrewriter = UnRewriter(host, prefix)

        referrer = request.environ.get('HTTP_REFERER', '')
        referrer = unrewriter.rewrite(referrer)

        html_unrewriter = HTMLDomUnRewriter(unrewriter)

        html_text = html_unrewriter.unrewrite(html_text, host=host)

        return self.write_snapshot(user, collection, url, title, html_text, referrer, user_agent)

    def snapshot_cont(self):
        info = self.browser_mgr.init_remote_browser_session()
        if not info:
            return {'error_message': 'conn not from valid containerized browser'}

        user = info['the_user']
        collection = info['collection']

        browser = info['browser']

        url = request.query.getunicode('url')

        title = request.query.getunicode('title')

        html_text = request.body.read().decode('utf-8')

        referrer = request.environ.get('HTTP_REFERER', '')

        user_agent = request.environ.get('HTTP_USER_AGENT')

        noprewriter = NopRewriter()
        html_unrewriter = HTMLDomUnRewriter(noprewriter)

        html_text = html_unrewriter.unrewrite(html_text)

        origin = request.environ.get('HTTP_ORIGIN')
        if origin:
            response.headers['Access-Control-Allow-Origin'] = origin

        #TODO
        return self.write_snapshot(user, collection, url,
                                   title, html_text, referrer,
                                   user_agent, browser)

    def write_snapshot(self, user, collection, url, title, html_text, referrer,
                       user_agent, browser=None):

        snap_title = 'Static Snapshots'

        snap_rec_name = self.sanitize_title(snap_title)

        recording = collection.get_recording_by_name(snap_rec_name)
        if not recording:
            recording = collection.create_recording(snap_rec_name,
                                                    title=snap_rec_name)

        kwargs = dict(user=user.name,
                      coll=collection.my_id,
                      rec=quote(snap_rec_name, safe='/*'),
                      type='put_record')

        params = {'url': url}

        upstream_url = self.content_app.get_upstream_url('', kwargs, params)

        headers = {'Content-Type': 'text/html; charset=utf-8',
                   'WARC-User-Agent': user_agent,
                   'WARC-Referer': referrer,
                  }

        r = requests.put(upstream_url,
                         data=BytesIO(html_text.encode('utf-8')),
                         headers=headers,
                        )

        try:
            res = r.json()
            if res['success'] != 'true':
                print(res)
                return {'error_message': 'Snapshot Failed'}

            warc_date = res.get('WARC-Date')

        except Exception as e:
            print(e)
            return {'error_message': 'Snapshot Failed'}


        if not title:
            return {'snapshot': ''}

        if warc_date:
            timestamp = iso_date_to_timestamp(warc_date)
        else:
            timestamp = timestamp_now()


        page_data = {'url': url,
                     'title': title,
                     'timestamp': timestamp,
                     'tags': ['snapshot'],
                    }
        if browser:
            page_data['browser'] = browser

        res = recording.add_page(page_data)

        return {'snapshot': page_data}

