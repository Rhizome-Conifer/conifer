
from argparse import ArgumentParser
from auth import init_manager_for_invite, RedisTable
import sys
import time


def main():
    parser = ArgumentParser()
    parser.add_argument('-i', '--invite')
    parser.add_argument('-l', '--list', action='store_true')

    r = parser.parse_args()

    m = init_manager_for_invite()

    if r.list:
        list_not_invited(m)
    elif r.invite:
        do_invite(m, r.invite)


def list_not_invited(m):
    invites = RedisTable(m.redis, 'h:invites')
    for n, v in invites.iteritems():
        if 'sent' not in v:
            print n + ' -- ' + v.get('desc', '')


def do_invite(m, email):
    res = m.send_invite(email,
                        email_template='templates/emailinvite.html',
                        host='https://beta.webrecorder.io')
    if res:
        print('Success')
    else:
        print('Fail')

    time.sleep(5)



if __name__ == "__main__":
    main()


