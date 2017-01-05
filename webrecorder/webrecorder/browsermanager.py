import requests
import gevent
from bottle import request

import socket
import os


# ============================================================================
class BrowserManager(object):
    def __init__(self, config, browser_redis, content_app):
        self.browser_redis = browser_redis

        self.browser_req_url = config['browser_req_url']
        self.browser_list_url = config['browser_list_url']
        self.browsers = {}

        if not os.environ.get('NO_REMOTE_BROWSERS'):
            self.load_all_browsers()
            gevent.spawn(self.browser_load_loop)

        self.content_app = content_app

        self.proxy_host = config['proxy_host']

        self.inactive_time = os.environ.get('INACTIVE_TIME', 60)

    def _get_proxy_ip(self):
        ip = None
        try:
            ip = socket.gethostbyname(self.proxy_host)
        except:
            pass

        return ip

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

    def init_cont_browser_sesh(self):
        remote_addr = request.environ['REMOTE_ADDR']
        if remote_addr != self._get_proxy_ip():
            print('Cont. Browser Request Not From Proxy, Rejecting')
            return

        source_addr = request.environ.get('HTTP_X_PROXY_FOR')

        container_data = self.browser_redis.hgetall('ip:' + source_addr)

        if not container_data or 'user' not in container_data:
            print('Data not found for remote ' + source_addr)
            return

        sesh = request.environ['webrec.session']
        sesh.set_restricted_user(container_data['user'])
        container_data['ip'] = source_addr
        return container_data

    def fill_upstream_url(self, kwargs, timestamp):
        params = {'closest': timestamp or 'now'}

        upstream_url = self.content_app.get_upstream_url('', kwargs, params)

        # adding separate to avoid encoding { and }
        upstream_url += '&url={url}'

        kwargs['upstream_url'] = upstream_url

    def request_new_browser(self, browser_id, wb_url, kwargs):
        self.fill_upstream_url(kwargs, wb_url.timestamp)

        container_data = {'upstream_url': kwargs['upstream_url'],
                          'user': kwargs['user'],
                          'coll': kwargs['coll_orig'],
                          'rec': kwargs['rec_orig'],
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
                'inactive_time': self.inactive_time,
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
