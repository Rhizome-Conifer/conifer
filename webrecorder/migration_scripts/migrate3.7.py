import redis
import os
import sys

def main():
    r = redis.StrictRedis.from_url(os.environ['REDIS_BASE_URL'], decode_responses=True)

    if len(sys.argv) > 1 and sys.argv[1] == '-d':
        print('Dry Run')
        dry = True
    else:
        print('Adding c:{user}:{coll}:recs keys')
        dry = False


    for key in r.scan_iter('r:*:*:*:info'):
        _, user, coll, rec, _2 = key.split(':')

        target_key = 'c:{user}:{coll}:recs'.format(user=user, coll=coll)
        print('sadd {0} {1}'.format(target_key, rec))

        if not dry:
            r.sadd(target_key, rec)

if __name__ == "__main__":
    main()

