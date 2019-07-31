import redis
import psutil
import time
import traceback
import sys
import atexit
import os
import tempfile

DEFAULT_REDIS_SETTINGS = [
    ('activerehashing', 'yes'),
    ('aof-load-truncated', 'yes'),
    ('aof-rewrite-incremental-fsync', 'yes'),
    ('appendfilename', 'appendonly.aof'),
    ('appendfsync', 'everysec'),
    ('appendonly', 'yes'),
    ('auto-aof-rewrite-min-size', '64mb'),
    ('auto-aof-rewrite-percentage', '100'),
    ('bind', '127.0.0.1'),
    ('daemonize', 'no'),
    ('databases', '16'),
    ('dbfilename', 'redis.db'),
    ('hash-max-ziplist-entries', '512'),
    ('hash-max-ziplist-value', '64'),
    ('hll-sparse-max-bytes', '3000'),
    ('hz', '10'),
    ('latency-monitor-threshold', '0'),
    ('list-max-ziplist-entries', '512'),
    ('list-max-ziplist-value', '64'),
    ('logfile', 'redis.log'),
    ('loglevel', 'notice'),
    ('lua-time-limit', '5000'),
    ('no-appendfsync-on-rewrite', 'no'),
    ('notify-keyspace-events', '""'),
    ('rdbchecksum', 'yes'),
    ('rdbcompression', 'yes'),
    ('repl-disable-tcp-nodelay', 'no'),
    ('save', '900 1'),
    ('save', '300 100'),
    ('save', '60 200',),
    ('save', '15 1000'),
    ('set-max-intset-entries', '512'),
    ('slave-priority', '100'),
    ('slave-read-only', 'yes'),
    ('slave-serve-stale-data', 'yes'),
    ('slowlog-log-slower-than', '10000'),
    ('slowlog-max-len', '128'),
    ('stop-writes-on-bgsave-error', 'yes'),
    ('tcp-backlog', '511'),
    ('tcp-keepalive', '0'),
    ('timeout', '0'),
    ('zset-max-ziplist-entries', '128'),
    ('zset-max-ziplist-value', '64')
]



# ============================================================================
class LocalRedisServer:
    MAIN_REDIS_CONN_NAME = '@wr-runner'

    def __init__(self, port, redis_dir=None, db=0):
        self.port = port
        self.db = db

        if not redis_dir:
            self.temp_dir_obj = tempfile.TemporaryDirectory(prefix='redis')
            self.redis_dir = self.temp_dir.name
        else:
            self.redis_dir = redis_dir
            os.makedirs(redis_dir, exist_ok=True)
            self.temp_dir_obj = None

        self.pidfile = os.path.abspath(os.path.join(self.redis_dir, 'redis.pid'))

        if getattr(sys, 'frozen', False):
            curr_dir = os.path.dirname(sys.argv[0])
        else:
            curr_dir = os.getcwd()

        if os.name == 'nt':
            redis_filename = 'redis-server.exe'
        else:
            redis_filename = 'redis-server'

        # use local copy only if exists
        full_path = os.path.join(curr_dir, redis_filename)
        if os.path.isfile(full_path):
            self.redis_server_path = full_path
        else:
            self.redis_server_path = redis_filename

        self.process = None
        self.redis_cli = None

        atexit.register(self.close)

    def _init_redis(self):
        self.redis_cli = redis.StrictRedis(host='127.0.0.1',
                                           port=self.port,
                                           db=self.db,
                                           decode_responses=True)

        self.redis_cli.client_setname(self.MAIN_REDIS_CONN_NAME)
        return self.redis_cli

    def start(self):
        try:
            self._init_redis()

        except redis.exceptions.ConnectionError:
            self.create_redis_server()
            return self.redis_cli

        except Exception:
            traceback.print_exc()
            return self.redis_cli

        try:
            with open(self.pidfile, 'rt') as fh:
                pid = fh.read()
        except:
            pid = self.redis_cli.get('redis_pid')

        if pid:
            print('Connected, Pid: ' + pid)
            self.process = psutil.Process(int(pid))
        else:
            print('Redis Pid Not Found!')

        return self.redis_cli

    def close(self):
        if not self.redis_cli:
            print('no redis client')
            return

        if not self.process:
            print('no process')
            return

        num_runners = 0
        clients = self.redis_cli.client_list()
        for client in clients:
            if client.get('name') == self.MAIN_REDIS_CONN_NAME:
                num_runners += 1

        print('Total Conn: {0}'.format(len(clients)))
        print('Total Unique Procs: {0}'.format(num_runners))
        if num_runners == 1:
            print('Last WR Process, Shutting Down Redis')
            self.terminate_server()

        if self.temp_dir_obj:
            self.temp_dir_obj.cleanup()
            self.temp_dir_obj = None

    def create_redis_server(self):
        self.redis_conf_path = os.path.join(self.redis_dir, 'redis.conf')

        config = DEFAULT_REDIS_SETTINGS.copy()
        config.append(('dir', self.redis_dir))
        config.append(('pidfile', self.pidfile))

        with open(self.redis_conf_path, 'wt') as fh:
            for key, value in config:
                fh.write('{0} {1}\n'.format(key, value))

        self.process = psutil.Popen([self.redis_server_path, self.redis_conf_path, '--port', str(self.port)],
                                    cwd=self.redis_dir)

        while True:
            try:
                r = self._init_redis()
                print('Set pid: ' + str(self.process.pid))
                r.set('redis_pid', self.process.pid)
                break
            except redis.exceptions.ConnectionError:
                time.sleep(0.1)
                print('Waiting...')

            except Exception:
                traceback.print_exc()

    def terminate_server(self):
        if self.process:
            print('Terminating Process')
            self.process.terminate()
            self.process = None
        else:
            print('No Process!')

if __name__ == '__main__':
    LocalRedisServer('redis-server', 7679, redis_dir='./redis_data').start()
    print('Done')
    time.sleep(10)
