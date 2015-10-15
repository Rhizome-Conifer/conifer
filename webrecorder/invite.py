#!/usr/bin/env python

from argparse import ArgumentParser
from manager import init_manager_for_invite
from redisutils import RedisTable

import sys
import time
import json


def main():
    parser = ArgumentParser()
    parser.add_argument('-i', '--invite')
    parser.add_argument('-l', '--list', action='store_true')
    parser.add_argument('-b', '--backlog')

    r = parser.parse_args()

    m = init_manager_for_invite()

    if r.backlog:
        do_invite_backlog(m, r.backlog)
    if r.list:
        list_not_invited(m)
    elif r.invite:
        do_invite(m, r.invite)


def list_not_invited(m):
    invites = RedisTable(m.redis, 'h:invites')
    for n, v in invites.iteritems():
        if 'sent' not in v:
            print n + ': ' + v.get('name', '') + ' -- ' + v.get('desc', '')


def do_invite(m, email, email_template='templates/emailinvite.html'):
    res = m.send_invite(email,
                        email_template=email_template,
                        host='https://webrecorder.io')
    if res:
        print('Success')
    else:
        print('Fail')

    time.sleep(1)

def do_invite_backlog(m, filename):
    users = RedisTable(m.redis, 'h:users')
    with open(filename) as fh:
        for line in fh:
            line = line.rstrip('\n "')
            email = line.split(' "')[1]
            if m.redis.hget('h:invites', email):
                print('Already invited: ' + email)
                continue

            if m.redis.hget('h:arc_invites', email):
                print('Already Registered: ' + email)
                continue

            skip = False
            for n, v in users.iteritems():
                if v['email_addr'] == email:
                    skip = True
                    print('Already User: ' + email)
                    break

            if skip:
                continue

            print('INVITING: ' + email)
            m.redis.hset('h:invites', email, json.dumps({'email': email,
                                                         'desc': 'from letmeknow list',
                                                         'name': email}))

            do_invite(m, email, 'templates/emailinvite2.html')



if __name__ == "__main__":
    main()


