import os
import sys

# add parent dir to path to access webrecorder package
wr_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, wr_path)

from redis import StrictRedis
from webrecorder.models.usermanager import UserManager


# ============================================================================
def main():
    r = StrictRedis.from_url(os.environ['REDIS_BASE_URL'], decode_responses=True)

    all_users = r.smembers('s:users')

    for username in all_users:
        lower_username = username.lower()

        if r.hexists(UserManager.LC_USERNAMES_KEY, lower_username):
            print('case dupe, no case lookup for: ' + username)
            value = '-'
        else:
            value = username if lower_username != username else ''

        r.hset(UserManager.LC_USERNAMES_KEY, lower_username, value)
        print('case map: {0} -> {1}'.format(username, value))


main()

