from docker.client import Client
from docker.utils import kwargs_from_env

import os
import base64
import time
import redis
import yaml
import random
import traceback


#=============================================================================
class DockerController(object):
    def _load_config(self):
        with open('./config.yaml') as fh:
            config = yaml.load(fh)
        return config

    def __init__(self):
        config = self._load_config()

        self.REDIS_BROWSER_URL = os.environ['REDIS_BROWSER_URL']
        self.PYWB_HOST = os.environ.get('PYWB_HOST', 'netcapsule_pywb_1')
        self.C_EXPIRE_TIME = config['init_container_expire_secs']
        self.Q_EXPIRE_TIME = config['queue_expire_secs']
        self.REMOVE_EXP_TIME = config['remove_expired_secs']
        self.VERSION = config['api_version']

        self.VNC_PORT = config['vnc_port']
        self.CMD_PORT = config['cmd_port']

        self.MAX_CONT = config['max_containers']

        self.image_prefix = config['image_prefix']

        self.network_name = config.get('network_name', 'webrecorder_browsers')

        self.browser_list = config['browsers']
        self.browser_paths = {}

        for browser in self.browser_list:
            path = browser['path']
            if path in self.browser_paths:
                raise Exception('Already a browser for path {0}'.format(path))

            self.browser_paths[path] = browser

        self.default_browser = config['default_browser']
        self.redirect_paths = config['redirect_paths']

        self.randompages = []
        try:
            with open(config['random_page_file']) as fh:
                self.randompages = list([line.rstrip() for line in fh])
        except Exception as e:
            print(e)

        self.redis = redis.StrictRedis.from_url(self.REDIS_BROWSER_URL, decode_responses=True)

        self.redis.setnx('next_client', '1')
        self.redis.setnx('max_containers', self.MAX_CONT)
        self.redis.setnx('num_containers', '0')
        self.redis.setnx('cpu_auto_adjust', 5.5)

        # if num_containers is invalid, reset to 0
        try:
            assert(int(self.redis.get('num_containers') >= 0))
        except:
            self.redis.set('num_containers', 0)

        throttle_samples = config['throttle_samples']
        self.redis.setnx('throttle_samples', throttle_samples)

        throttle_max_avg = config['throttle_max_avg']
        self.redis.setnx('throttle_max_avg', throttle_max_avg)

        self.redis.setnx('container_expire_secs',
                         config['full_container_expire_secs'])

        self.duration = int(self.redis.get('container_expire_secs'))

        self.T_EXPIRE_TIME = config['throttle_expire_secs']

        if os.path.exists('/var/run/docker.sock'):
            self.cli = Client(base_url='unix://var/run/docker.sock',
                              version=self.VERSION)
        else:
            kwargs = kwargs_from_env(assert_hostname=False)
            kwargs['version'] = self.VERSION
            self.cli = Client(**kwargs)

    def _get_host_port(self, info, port, default_host):
        info = info['NetworkSettings']['Ports'][str(port) + '/tcp']
        info = info[0]
        host = info['HostIp']
        if host == '0.0.0.0' and default_host:
            host = default_host

        return host + ':' + info['HostPort']

    def timed_new_container(self, browser, env, host, client_id):
        start = time.time()
        info = self.new_container(browser, env, host)
        end = time.time()
        dur = end - start

        time_key = 't:' + client_id
        self.redis.setex(time_key, self.T_EXPIRE_TIME, dur)

        throttle_samples = int(self.redis.get('throttle_samples'))
        print('INIT DUR: ' + str(dur))
        self.redis.lpush('init_timings', time_key)
        self.redis.ltrim('init_timings', 0, throttle_samples - 1)

        return info

    def new_container(self, browser_id, env=None, default_host=None):
        browser = self.browser_paths.get(browser_id)

        # get default browser
        if not browser:
            browser = self.browser_paths.get(self.default_browser)

        if browser.get('req_width'):
            env['SCREEN_WIDTH'] = browser.get('req_width')

        if browser.get('req_height'):
            env['SCREEN_HEIGHT'] = browser.get('req_height')

        image = self.image_prefix + '/' + browser['id']
        print('Launching ' + image)

        container = self.cli.create_container(image=image,
                                              ports=[self.VNC_PORT, self.CMD_PORT],
                                              environment=env,
                                             )
        short_id = None
        try:
            id_ = container.get('Id')
            short_id = id_[:12]

            res = self.cli.start(container=id_,
                                 port_bindings={self.VNC_PORT: None, self.CMD_PORT: None},
                                 volumes_from=['webrecorder_browsermanager_1'],
                                 network_mode=self.network_name,
                                 cap_add=['ALL'],
                                )

            info = self.cli.inspect_container(id_)
            ip = info['NetworkSettings']['IPAddress']
            if not ip:
                ip = info['NetworkSettings']['Networks'][self.network_name]['IPAddress']

            self.redis.hset('all_containers', short_id, ip)

            vnc_host = self._get_host_port(info, self.VNC_PORT, default_host)
            cmd_host = self._get_host_port(info, self.CMD_PORT, default_host)
            print(ip)
            print(vnc_host)
            print(cmd_host)

            return {'vnc_host': vnc_host,
                    'cmd_host': cmd_host,
                    'ip': ip,
                   }

        except Exception as e:
            if short_id:
                self.remove_container(short_id)

            traceback.print_exc()
            return {}

    def remove_container(self, short_id):
        print('REMOVING ' + short_id)
        try:
            self.cli.remove_container(short_id, force=True)
        except Exception as e:
            print(e)

        ip = self.redis.hget('all_containers', short_id)

        with redis.utils.pipeline(self.redis) as pi:
            pi.delete('ct:' + short_id)

            if not ip:
                return

            pi.hdel('all_containers', short_id)
            pi.delete('ip:' + ip)

    def event_loop(self):
        for event in self.cli.events(decode=True):
            try:
                self.handle_docker_event(event)
            except Exception as e:
                print(e)

    def handle_docker_event(self, event):
        if event['Type'] != 'container':
            return

        if event['status'] == 'die' and event['from'].startswith('webrecorder/browser-'):
            short_id = event['id'][:12]
            self.remove_container(short_id)
            print('EXITED: ' + short_id)
            self.redis.decr('num_containers')
            return

        if event['status'] == 'start' and event['from'].startswith('webrecorder/browser-'):
            self.redis.incr('num_containers')
            short_id = event['id'][:12]
            print('STARTED: ' + short_id)
            self.redis.setex('ct:' + short_id, self.duration, 1)
            return

    def remove_expired_loop(self):
        while True:
            try:
                self.remove_expired()
            except Exception as e:
                print(e)

            time.sleep(30)

    def remove_expired(self):
        all_known_ids = self.redis.hkeys('all_containers')

        all_containers = {c['Id'][:12] for c in self.cli.containers(quiet=True)}

        for short_id in all_known_ids:
            if not self.redis.get('ct:' + short_id):
                print('TIME EXPIRED: ' + short_id)
                self.remove_container(short_id)
            elif short_id not in all_containers:
                print('STALE ID: ' + short_id)
                self.remove_container(short_id)

    def check_nodes(self):
        print('Check Nodes')
        try:
            scale = self.redis.get('cpu_auto_adjust')
            if not scale:
                return

            info = self.cli.info()
            cpus = int(info.get('NCPU', 0))
            if cpus <= 1:
                return

            total = int(float(scale) * cpus)
            self.redis.set('max_containers', total)

        except Exception as e:
            traceback.print_exc()

    def add_new_client(self):
        client_id = self.redis.incr('clients')
        enc_id = base64.b64encode(os.urandom(27)).decode('utf-8')
        self.redis.setex('cm:' + enc_id, self.Q_EXPIRE_TIME, client_id)
        self.redis.setex('q:' + str(client_id), self.Q_EXPIRE_TIME, 1)
        return enc_id, client_id

    def is_valid_request(self, params):
        upsid = params.get('upsid', '')
        old_key = 'ups:' + upsid

        upstream_url = self.redis.hget(old_key, 'upstream_url')
        if not upstream_url:
            return None

        return old_key

    def am_i_next(self, enc_id):
        client_id = None
        if enc_id:
            self.redis.expire('cm:' + enc_id, self.Q_EXPIRE_TIME)
            client_id = self.redis.get('cm:' + enc_id)

        if not client_id:
            enc_id, client_id = self.add_new_client()

        client_id = int(client_id)
        next_client = int(self.redis.get('next_client'))

        # not next client
        if client_id != next_client:
            # if this client expired, delete it from queue
            if not self.redis.get('q:' + str(next_client)):
                print('skipping expired', next_client)
                self.redis.incr('next_client')

            # missed your number somehow, get a new one!
            if client_id < next_client:
                enc_id, client_id = self.add_new_client()

        diff = client_id - next_client

        if self.throttle():
            self.redis.expire('q:' + str(client_id), self.Q_EXPIRE_TIME)
            return enc_id, client_id - next_client

        #num_containers = self.redis.hlen('all_containers')
        num_containers = int(self.redis.get('num_containers'))

        max_containers = self.redis.get('max_containers')
        max_containers = int(max_containers) if max_containers else self.MAX_CONT

        if diff <= (max_containers - num_containers):
            self.redis.incr('next_client')
            return enc_id, -1

        else:
            self.redis.expire('q:' + str(client_id), self.Q_EXPIRE_TIME)
            return enc_id, client_id - next_client

    def throttle(self):
        timings = self.redis.lrange('init_timings', 0, -1)
        if not timings:
            return False

        timings = self.redis.mget(*timings)

        avg = 0
        count = 0
        for val in timings:
            if val is not None:
                avg += float(val)
                count += 1

        if count == 0:
            return False

        avg = avg / count

        print('AVG: ', avg)
        throttle_max_avg = float(self.redis.get('throttle_max_avg'))
        if avg >= throttle_max_avg:
            print('Throttling, too slow...')
            return True

        return False

    def do_init(self, browser, url, ts, host, client_id,
                width=None, height=None):
        env = {}
        env['URL'] = url
        env['TS'] = ts
        env['SCREEN_WIDTH'] = width or os.environ.get('SCREEN_WIDTH')
        env['SCREEN_HEIGHT'] = height or os.environ.get('SCREEN_HEIGHT')
        env['REDIS_BROWSER_URL'] = self.REDIS_BROWSER_URL
        env['PYWB_HOST_PORT'] = self.PYWB_HOST + ':8080'
        env['BROWSER'] = browser

        info = self.timed_new_container(browser, env, host, client_id)
        info['queue'] = 0
        return info

    def get_randompage(self):
        if not self.randompages:
            return '/'

        url, ts = random.choice(self.randompages).split(' ', 1)
        print(url, ts)
        path = self.get_random_browser()
        return '/' + path + '/' + ts + '/' + url

    def get_random_browser(self):
        while True:
            id_ = random.choice(self.browser_paths.keys())
            if self.browser_paths[id_].get('skip_random'):
                continue

            return id_
