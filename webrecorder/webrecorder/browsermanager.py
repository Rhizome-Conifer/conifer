import requests
import gevent
from bottle import request

from webrecorder.models.stats import Stats
from webrecorder.utils import get_bool

import socket
import os


# ============================================================================
class BrowserManager(object):
    running = True

    def __init__(self, config, browser_redis, user_manager):
        self.browser_redis = browser_redis

        self.browser_req_url = config['browser_req_url']
        self.browser_list_url = config['browser_list_url']
        self.browsers = {}

        if not get_bool(os.environ.get('NO_REMOTE_BROWSERS')):
            self.load_all_browsers()

            gevent.spawn(self.browser_load_loop)

        self.user_manager = user_manager

        self.inactive_time = os.environ.get('INACTIVE_TIME', 60)

    def load_all_browsers(self):
        try:
            r = requests.get(self.browser_list_url)
            self.browsers = r.json()

        except Exception as e:
            print(e)

    def get_browsers(self):
        return self.browsers

    def browser_load_loop(self):
        while self.running:
            gevent.sleep(300)
            self.load_all_browsers()

    def init_cont_browser_sesh(self):
        remote_addr = request.environ['REMOTE_ADDR']

        container_data = self.browser_redis.hgetall('ip:' + remote_addr)

        if not container_data or 'user' not in container_data:
            print('Data not found for remote ' + remote_addr)
            return

        username = container_data.get('user')

        sesh = self.get_session()
        sesh.set_restricted_user(username)
        sesh.set_id(self.browser_sesh_id(container_data['reqid']))

        container_data['ip'] = remote_addr

        the_user = self.user_manager.all_users[username]

        collection = the_user.get_collection_by_id(container_data['coll'],
                                                   container_data.get('coll_name', ''))
        recording = None

        if collection:
            recording = collection.get_recording(container_data.get('rec'))

        container_data['the_user'] = the_user
        container_data['collection'] = collection
        container_data['recording'] = recording
        return container_data

    def update_local_browser(self, data):
        self.browser_redis.hmset('ip:127.0.0.1', data)

    def browser_sesh_id(self, reqid):
        return 'reqid_' + reqid

    def _api_new_browser(self, req_url, container_data):
        r = requests.post(req_url, data=container_data)
        return r.json()

    def request_new_browser(self, container_data):
        browser_id = container_data['browser']
        try:
            req_url = self.browser_req_url.format(browser=browser_id)
            res = self._api_new_browser(req_url, container_data)

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

        # browser page insert
        data = {'browser': browser_id,
                'browser_data': self.browsers.get(browser_id),
                'url': container_data['url'],
                'timestamp': container_data['request_ts'],
                'reqid': reqid,
                'inactive_time': self.inactive_time,
               }

        return data

    def update_remote_browser(self, reqid, timestamp=None, url=None,
                              type_=None,
                              coll=None, rec=None):

        ip = self.browser_redis.hget('req:' + reqid, 'ip')
        if not ip:
            return {'error_message': 'No Container Found'}

        container_data = self.browser_redis.hgetall('ip:' + ip)

        if not container_data:
            return {'error_message': 'Invalid Container'}

        if timestamp:
            container_data['request_ts'] = timestamp

        if url:
            container_data['url'] = url

        is_writable = container_data.get('browser_can_write')
        try:
            if type_:
                assert(is_writable)
                container_data['type'] = type_

            if coll:
                assert(is_writable)
                container_data['coll'] = coll

            if rec:
                assert(is_writable)
                container_data['rec'] = rec
        except:
            return {'error_message': 'Not a writable browser'}

        self.browser_redis.hmset('ip:' + ip, container_data)

        return {}

    def get_session(self):
        return request.environ['webrec.session']
