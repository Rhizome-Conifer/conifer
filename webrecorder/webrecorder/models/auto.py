from webrecorder.models.base import RedisUniqueComponent
import json
import requests
import os
from urllib.parse import urlsplit


# ============================================================================
class Auto(RedisUniqueComponent):
    MY_TYPE = 'auto'
    ALL_KEYS = 'a:{auto}:*'

    INFO_KEY = 'a:{auto}:info'
    Q_KEY = 'a:{auto}:q'
    QP_KEY = 'a:{auto}:qp'
    SEEN_KEY = 'a:{auto}:seen'

    SCOPE_KEY = 'a:{auto}:scope'

    BR_KEY = 'a:{auto}:br'
    BR_DONE_KEY = 'a:{auto}:br:done'

    DEFAULT_DEPTH = 1

    DEFAULT_NUM_BROWSERS = 2

    DEFAULT_BROWSER = 'chrome:67'

    DEFAULT_FLOCK = 'browsers'

    DEFAULT_SHEPHERD = 'http://shepherd:9020'

    BROWSER_API_URL = DEFAULT_SHEPHERD + '/api/auto-pool'

    SCOPES = ['single-page', 'same-domain', 'all-links']

    AUTO_CONTAINER_ENVIRON = {}

    @classmethod
    def init_props(cls, config):
        cls.AUTO_CONTAINER_ENVIRON = {
            'URL': 'about:blank',
            'REDIS_URL': os.environ['REDIS_BASE_URL'],
            'WAIT_FOR_Q': '5',
            'TAB_TYPE': 'CrawlerTab',
            'VNC_PASS': 'pass',
            'IDLE_TIMEOUT': '',
            'BEHAVIOR_API_URL': 'http://behaviors:3030',
        }

    def __init__(self, **kwargs):
        super(Auto, self).__init__(**kwargs)
        self.frontier_q_key = self.Q_KEY.format(auto=self.my_id)

        self.seen_key = self.SEEN_KEY.format(auto=self.my_id)

        self.browser_key = self.BR_KEY.format(auto=self.my_id)
        self.browser_done_key = self.BR_DONE_KEY.format(auto=self.my_id)

        self.pending_q_key = self.QP_KEY.format(auto=self.my_id)

        self.scopes_key = self.SCOPE_KEY.format(auto=self.my_id)

    def init_new(self, collection, props=None):
        self.owner = collection

        aid = self._create_new_id()

        props = props or {}

        scope_type = props.get('scope', 'single-page')

        if scope_type == 'all-links':
            crawl_depth = 1
        elif scope_type == 'same-domain':
            crawl_depth = 100
        else:
            crawl_depth = 0

        self.data = {
                     'num_browsers': props.get('num_browsers', self.DEFAULT_NUM_BROWSERS),
                     'num_tabs': props.get('num_tabs', 1),
                     'owner': collection.my_id,
                     'scope_type': scope_type,
                     'status': 'new',
                     'crawl_depth': crawl_depth
                    }

        self._init_new()

        return aid

    def _init_domain_scopes(self, urls):
        domains = set()

        for url in urls:
            domain = urlsplit(url).netloc
            domains.add(domain)

        if not domains:
            return

        for domain in domains:
            self.redis.sadd(self.scopes_key, json.dumps({'domain': domain}))

    def queue_urls(self, urls):
        for url in urls:
            url_req = {'url': url, 'depth': 0}
            print('Queuing: ' + str(url_req))
            self.redis.rpush(self.frontier_q_key, json.dumps(url_req))

            # add to seen list to avoid dupes
            self.redis.sadd(self.seen_key, url)

        if self['scope_type'] == 'same-domain':
            self._init_domain_scopes(urls)

        return {'success': True}

    @classmethod
    def do_request(self, url_path, post_data=None, use_pool=True):
        err = None
        try:
            res = requests.post((self.BROWSER_API_URL if use_pool else self.DEFAULT_SHEPHERD) + url_path, json=post_data)
            return res.json()
        except Exception as e:
            err = {'error': str(e)}
            if res:
                err['details'] = res.text

            return err

    def start(self, timeout=0, headless=False, screenshot_uri=None):
        if self['status'] == 'running':
            return {'error': 'already_running'}

        collection = self.get_owner()

        recording = collection.create_recording(rec_type='auto')

        browser_id = self.get_prop('browser_id') or self.DEFAULT_BROWSER

        browser_data = {
                        'user': collection.get_owner().name,
                        'coll': collection.my_id,
                        'rec': recording.my_id,
                        'browser_can_write': '1',
                        'browser': browser_id,
                        'request_ts': '',
                        'type': 'record',
                        'auto_id': self.my_id,
                       }

        environ = self.AUTO_CONTAINER_ENVIRON.copy()
        environ['AUTO_ID'] = self.my_id
        if timeout > 0:
            environ['BEHAVIOR_RUN_TIME'] = timeout

        if screenshot_uri:
            environ['SCREENSHOT_TARGET_URI'] = screenshot_uri
            environ['SCREENSHOT_API_URL'] = 'http://nginx/api/v1/remote/put-record'
            environ['SCREENSHOT_FORMAT'] = 'png'

        deferred = {'autodriver': False}
        if headless:
            deferred['xserver'] = True

        opts = dict(overrides={'browser': 'oldwebtoday/' + browser_id,
                               'xserver': 'oldwebtoday/vnc-webrtc-audio'},
                    deferred=deferred,
                    user_params=browser_data,
                    environ=environ)

        errors = []

        for x in range(int(self['num_browsers'])):
            res = self.do_request('/request_flock/' + self.DEFAULT_FLOCK, opts)
            reqid = res.get('reqid')
            if not reqid:
                if 'error' in res:
                    errors.append(res['error'])
                continue

            res = self.do_request('/start_flock/' + reqid,
                                  {'environ': {'REQ_ID': reqid}})

            if 'error' in res:
                errors.append(res['error'])
            else:
                self.redis.sadd(self.browser_key, reqid)

        if not errors:
            self['status'] = 'running'
            self['rec'] = recording.my_id
            return {'success': True,
                    'browsers': list(self.redis.smembers(self.browser_key))}

        else:
            return {'error': 'not_started', 'details': errors}

    def stop(self):
        if self['status'] != 'running':
            return {'error': 'not_running'}

        errors = []

        for reqid in self.redis.smembers(self.browser_key):
            res = self.do_request('/stop_flock/{0}'.format(reqid))
            if 'error' in res:
                errors.append(res['error'])

        if not errors:
            self['status'] = 'stopped'
            return {'success': True}
        else:
            return {'error': 'not_stopped', 'details': errors}

    def is_done(self):
        status = self['status']
        if status == 'done':
            return True

        # if not running, won't be done
        if status != 'running':
            return False

        # if frontier not empty, not done
        if self.redis.llen(self.frontier_q_key) > 0:
            return False

        # if pending q not empty, not done
        if self.redis.scard(self.pending_q_key) > 0:
            return False

        # if not all browsers are done, not done
        browsers = self.redis.smembers(self.browser_key)
        browsers_done = self.redis.smembers(self.browser_done_key)
        if browsers != browsers_done:
            return False

        collection = self.get_owner()

        # if automation recording still pending, not yet done
        recording = collection.get_recording(self['rec'])
        if not recording or recording.get_pending_count() > 0:
            return False

        self['status'] = 'done'
        return True

    def serialize(self, include_details=True):
        data = super(Auto, self).serialize()
        if not include_details:
            return data

        browsers = self.redis.smembers(self.browser_key)

        data['browsers'] = list(browsers)
        data['browsers_done'] = list(self.redis.smembers(self.browser_done_key))

        data['scopes'] = list(self.redis.smembers(self.scopes_key))

        data['queue'] = self.redis.lrange(self.frontier_q_key, 0, -1)
        data['pending'] = list(self.redis.smembers(self.pending_q_key))
        data['seen'] = list(self.redis.smembers(self.seen_key))
        return data

    def delete_me(self):
        self.access.assert_can_admin_coll(self.get_owner())

        res = self.stop()

        if not self.delete_object():
            return False




