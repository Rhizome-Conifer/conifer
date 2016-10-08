from gevent import monkey, spawn, Timeout, sleep
monkey.patch_all()


from bottle import route, default_app, run, request, response, redirect

import requests
import logging
from redis import StrictRedis

import time
import sys
import os
import json
import traceback

from argparse import ArgumentParser

from bottle.ext.websocket import GeventWebSocketServer
from bottle.ext.websocket import websocket

from geventwebsocket.exceptions import WebSocketError


PYWB_HOST_PORT = os.environ.get('PYWB_HOST_PORT', 'netcapsule_pywb_1:8080')

LOCAL_REDIS_URL = 'redis://redis:6379/0'

#REDIS_URL = os.environ.get('REDIS_BROWSER_URL', LOCAL_REDIS_URL)

BROWSER = os.environ.get('BROWSER')

my_ip = '127.0.0.1'

pywb_ip = '127.0.0.1'
start_url = None

curr_ts = None

local_redis = None

stat_key_expire_time = 40

HOST = os.environ.get('HOSTNAME', 'localhost')

closed = False



def set_timestamp(timestamp):
    params = {'ts': timestamp,
              'ip': my_ip}

    try:
        r = requests.get('http://set.pywb.proxy/', params=params,
                         proxies={'http': PYWB_HOST_PORT,
                                  'https': PYWB_HOST_PORT})

        if r.status_code == 200:
            global curr_ts
            curr_ts = timestamp

            return {'success': r.json()}
        else:
            return {'error': r.body}

    except Exception as e:
        return {'error': str(e)}


#@route('/set')
#def route_set_ts():
#    ts = request.query.get('ts')
#    res = set_timestamp(ts)
#    return res

#@route('/pingsock', apply=[websocket])
def pingsock(ws):
    if ws:
        spawn(receiver, ws)

    last_data = None
    sleep_timeout = 0.5

    duration = int(redis.get('container_expire_secs'))

    global closed

    if closed:
        try:
            # reentrancy: user returned likely after back/forward
            # using cached response
            remainder = redis.get('c:' + HOST)

            if remainder.startswith('REM:'):
                old_time = int(remainder[len('REM:'):])
                # subtract time user was away
                old_time -= (stat_key_expire_time - redis.ttl('c:' + HOST))
                duration = old_time

        except Exception as e:
            traceback.print_exc(e)
        finally:
            closed = False

    redis.expire('c:' + HOST, duration)

    logging.debug('Controller for: ' + BROWSER)

    while not closed:
        try:
            data = get_update()
            if data != last_data:
                data['ttl'] = redis.ttl('c:' + HOST)
                logging.debug('Sending ' + str(data))
                ws.send(json.dumps(data))
                last_data = data

                # for comparison check
                del last_data['ttl']
        except WebSocketError as e:
            traceback.print_exc(e)
            mark_for_removal()
            break
        except Exception as e:
            traceback.print_exc(e)

        sleep(sleep_timeout)

def receiver(ws):
    while not closed and ws:
        try:
            data = ws.receive()
            logging.debug('Received ' + str(data))
            if data is None:
                continue

            data = json.loads(data)
            if data['ts']:
                set_timestamp(data['ts'])

        except WebSocketError as e:
            traceback.print_exc()
            mark_for_removal()
            break

        except Exception as e:
            print(e)
            #traceback.print_exc(e)

def mark_for_removal():
    logging.debug('Marked for removal')

    #ttl = redis.ttl('c:' + HOST)
    #redis.setex('c:' + HOST, stat_key_expire_time, 'REM:' + str(ttl))

    logging.debug('DELETING IP: ' + my_ip)

    #redis.delete('ip:' + my_ip)
    #redis.delete('from_ip:q:' + my_ip)

    #redis.rpush('remove_q', HOST + ' ' + my_ip)

    global closed
    closed = True

    # just exit to shutdown container
    # will prevent reentrancy, but much safer for now
    sys.exit(0)


#def shutdown():
    #duration = int(redis.get('container_expire_secs'))

    #sleep(duration + 10)

#    mark_for_removal()

def get_update():
#    if not redis.hget('all_containers', HOST):
#        return

#    global expire_time
#    expire_time = redis.get('container_expire_time')
#    if not expire_time:
#        expire_time = DEF_EXPIRE_TIME

#    redis.expire('c:' + HOST, expire_time)

    #ts = request.query.get('ts')

    base_key = my_ip + ':' + curr_ts + ':'

    pi = local_redis.pipeline(transaction=False)

    pi.hgetall(base_key + 'urls')
    pi.smembers(base_key + 'hosts')
    pi.get(base_key + 'ref')
    pi.get(base_key + 'base')

    pi.expire(base_key + 'urls', stat_key_expire_time)
    pi.expire(base_key + 'hosts', stat_key_expire_time)
    pi.expire(base_key + 'ref', stat_key_expire_time)
    pi.expire(base_key + 'base', stat_key_expire_time)

    result = pi.execute()

    # all urls
    all_urls = result[0]

    count = 0
    min_sec = sys.maxint
    max_sec = 0
    for url, sec in all_urls.iteritems():
        count += 1
        sec = int(sec)
        min_sec = min(sec, min_sec)
        max_sec = max(sec, max_sec)

    # all_hosts
    all_hosts = result[1]

    referrer = result[2]
    base = result[3]

    page_url = referrer
    if not referrer:
        # never sends referrer so just stick with initial url
        # or thinks will get confusing..
        if BROWSER == 'mosaic':
            page_url = start_url
        else:
            page_url = base

    page_url_secs = int(all_urls.get(page_url, 0))

    return {'urls': count,
            'req_ts': curr_ts,
            'min_sec': min_sec,
            'max_sec': max_sec,
            'hosts': list(all_hosts),
            'page_url': page_url,
            'page_url_secs': page_url_secs,
           }


@route('/')
def homepage():
    global start_url
    redirect(start_url, code=302)




PROXY_PAC = """
function FindProxyForURL(url, host)
{
    if (isInNet(host, "10.0.2.2") || shExpMatch(url, "http://10.0.2.2:6082/*")) {
        return "DIRECT";
    }

    return "PROXY %s:8080";
}
"""

@route('/proxy.pac')
def proxy():
    response.content_type = 'application/x-ns-proxy-autoconfig'
    return PROXY_PAC % pywb_ip


def do_init():
    logging.basicConfig(format='%(asctime)s: [%(levelname)s]: %(message)s',
                        level=logging.DEBUG)

    parser = ArgumentParser('netcapsule browser manager')
    parser.add_argument('--my-ip')
    parser.add_argument('--pywb-ip')
    parser.add_argument('--start-url')
    parser.add_argument('--start-ts')

    r = parser.parse_args()

    global my_ip
    my_ip = r.my_ip

    global pywb_ip
    pywb_ip = r.pywb_ip

    global start_url
    start_url = r.start_url
    if '://' not in start_url:
        start_url = 'http://' + start_url

    # not used here for now
    global curr_ts
    curr_ts = r.start_ts

    #global redis
    #redis = StrictRedis.from_url(REDIS_URL)

    #global local_redis
    #local_redis = StrictRedis.from_url(LOCAL_REDIS_URL)

    # set initial url
    #base_key = my_ip + ':' + curr_ts + ':'
    #local_redis.set(base_key + 'r', start_url)

    return default_app()

application = do_init()

@application.hook('after_request')
def enable_cors():
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'PUT, GET, POST, DELETE, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Origin, Accept, Content-Type, X-Requested-With, X-CSRF-Token'


def test_for_done():
    while True:
        if os.path.isfile('/home/browser/.done'):
            mark_for_removal()

        sleep(10)


#spawn(shutdown)

spawn(test_for_done)


if __name__ == "__main__":
    run(host='0.0.0.0', port='6082', server=GeventWebSocketServer)

