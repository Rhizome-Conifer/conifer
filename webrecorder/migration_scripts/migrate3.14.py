import redis
import os
import sys

def main():
    """
    Recordings now get closed after inaction
    Adding r:user:coll:rec:open for 10 mins to all ensure current recordings have a chance to be added to
    """
    r = redis.StrictRedis.from_url(os.environ['REDIS_BASE_URL'], decode_responses=True)

    if len(sys.argv) > 1 and sys.argv[1] == '-d':
        print('Dry Run')
        dry = True
    else:
        print('Adding u:{user}:{coll}:{rec}:open keys')
        dry = False


    for key in r.scan_iter('r:*:cdxj'):
        open_key = key.rsplit(':', 1)[0] + ':open'
        print('setex {0} 600 1'.format(open_key))

        if not dry:
            r.set(open_key, 1, ex=600)

if __name__ == "__main__":
    main()
