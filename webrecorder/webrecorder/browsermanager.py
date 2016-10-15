import requests
import gevent
from webrecorder.unrewriter import HTMLDomUnRewriter, NopRewriter


# ============================================================================
class BrowserManager(object):
    def __init__(self, config, browser_redis):
        self.browser_redis = browser_redis

        self.browser_req_url = config['browser_req_url']
        self.browser_list_url = config['browser_list_url']
        self.browsers = {}

        # set from contentcontroller
        self.rewriter = None

        self.load_all_browsers()
        gevent.spawn(self.browser_load_loop)

    def load_all_browsers(self):
        try:
            r = requests.get(self.browser_list_url)
            self.browsers = r.json()

        except Exception as e:
            print(e)

    def get_browsers(self):
        return self.browsers

    def browser_load_loop(self):
        while True:
            gevent.sleep(300)
            self.load_all_browsers()

    def fill_upstream_url(self, kwargs, timestamp):
        params = {'closest': timestamp or 'now'}

        upstream_url = self.rewriter.get_upstream_url('', kwargs, params)

        # adding separate to avoid encoding { and }
        upstream_url += '&url={url}'

        kwargs['upstream_url'] = upstream_url

    def request_new_browser(self, browser_id, wb_url, kwargs):
        self.fill_upstream_url(kwargs, wb_url.timestamp)

        container_data = {'upstream_url': kwargs['upstream_url'],
                          'user': kwargs['user'],
                          'coll': kwargs['coll'],
                          'rec': kwargs['rec'],
                          'request_ts': wb_url.timestamp,
                          'url': wb_url.url,
                          'type': kwargs['type'],
                          'browser': browser_id,
                          'can_write': kwargs['can_write']
                         }

        try:
            req_url = self.browser_req_url.format(browser=browser_id)
            r = requests.post(req_url, data=container_data)
            res = r.json()

        except Exception as e:
            print(e)
            msg = 'Browser <b>{0}</b> could not be requested'.format(browser_id)
            return {'error_message': msg}

        reqid = res.get('reqid')

        if not reqid:
            msg = 'Browser <b>{0}</b> is not available'.format(browser_id)
            return {'error_message': msg}

        # get canonical browser id
        browser_id = res.get('id')

        kwargs['browser'] = browser_id

        # browser page insert
        data = {'browser': browser_id,
                'browser_data': self.browsers.get(browser_id),
                'url': wb_url.url,
                'ts': wb_url.timestamp,
                'reqid': reqid,
               }

        return data

    def switch_upstream(self, rec, type_, reqid):
        ip = self.browser_redis.hget('req:' + reqid, 'ip')
        if not ip:
            return

        container_data = self.browser_redis.hgetall('ip:' + ip)
        if not container_data:
            return

        if not container_data.get('can_write'):
            print('Not a writtable browser')
            return

        container_data['rec'] = rec
        container_data['type'] = type_
        self.fill_upstream_url(container_data, container_data.get('request_ts'))

        self.browser_redis.hmset('ip:' + ip, container_data)

    def browser_snapshot(self, user, coll, browser, msg):
        params = msg['params']

        url = params['url']

        user_agent = params['user_agent']

        referrer = params['top_url']

        # title included only for top level pages
        title = params.get('title', '')

        html_text = msg['contents']

        noprewriter = NopRewriter()
        html_unrewriter = HTMLDomUnRewriter(noprewriter)

        html_text = HTMLDomUnRewriter.remove_head_insert(html_text)

        html_text = html_unrewriter.rewrite(html_text)
        html_text += html_unrewriter.close()

        return self.rewriter.write_snapshot(user, coll, url,
                                            title, html_text, referrer,
                                            user_agent, browser)


