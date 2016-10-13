import requests
import gevent


class BrowserManager(object):
    def __init__(self, config):
        self.browser_req_url = config['browser_req_url']
        self.browser_list_url = config['browser_list_url']
        self.browsers = {}

        self.load_all_browsers()
        gevent.spawn(self.browser_load_loop)

    def load_all_browsers(self):
        try:
            r = requests.get(self.browser_list_url)
            self.browsers = r.json()

        except Exception as e:
            print(e)

    def get_browser_list(self):
        return list(self.browsers.values())

    def browser_load_loop(self):
        while True:
            gevent.sleep(300)
            self.load_all_browsers()


    def request_new_browser(self, wb_url, kwargs):
        container_data = {'upstream_url': kwargs['upstream_url'],
                          'user': kwargs['user'],
                          'coll': kwargs['coll'],
                          'rec': kwargs['rec'],
                          'request_ts': wb_url.timestamp,
                          'url': wb_url.url,
                          'curr_mode': kwargs['type'],
                          'browser': kwargs['browser'],
                         }

        try:
            req_url = self.browser_req_url.format(browser=kwargs['browser'])
            r = requests.post(req_url, data=container_data)
            res = r.json()

        except Exception as e:
            print(e)
            msg = 'Browser <b>{0}</b> could not be requested'.format(kwargs['browser'])
            self._raise_error(400, msg)

        reqid = res.get('reqid')

        if not reqid:
            msg = 'Browser <b>{0}</b> is not available'.format(kwargs['browser'])
            self._raise_error(400, msg)
            return

        browser_id = res.get('id')

        # browser page insert
        data = {'browser': browser_id,
                'browser_data': self.browsers.get(browser_id),
                'url': wb_url.url,
                'ts': wb_url.timestamp,
                'reqid': reqid,
               }

        return data


