import redis
import os
import sys

def main():
    r = redis.StrictRedis.from_url(os.environ['REDIS_BASE_URL'], decode_responses=True)

    if len(sys.argv) > 1 and sys.argv[1] == '-d':
        print('Dry Run')
        dry = True
    else:
        print('Adding u:{user}:colls keys')
        dry = False


    for key in r.scan_iter('c:*:*:info'):
        _, user, coll, _2 = key.split(':')

        target_key = 'u:{user}:colls'.format(user=user)
        print('sadd {0} {1}'.format(target_key, coll))

        if not dry:
            r.sadd(target_key, coll)

if __name__ == "__main__":
    main()

