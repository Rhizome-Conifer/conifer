#!/usr/bin/env python

import json
import os
import re
import redis
import time

from argparse import ArgumentParser, RawTextHelpFormatter
from datetime import datetime
from six import iteritems
from string import ascii_lowercase as alpha

from webrecorder.models.usermanager import CLIUserManager

from webrecorder.redisutils import RedisTable
from webrecorder.utils import redis_pipeline

def main(args=None):
    parser = ArgumentParser(formatter_class=RawTextHelpFormatter)
    parser.add_argument('-c', '--create-user',
                        dest='create_user',
                        nargs='*',
                        default=None,
                        help=('Interface to add a new user. \n\n'
                              'supply arguments e.g.\n'
                              '`python admin.py -c <email> <username> <passwd> <role> \'<full name>\'`\n'
                              '\n or simply `python admin.py -c` for interactive creation.'))

    parser.add_argument('-m', '--modify-user', dest='modify_user',
                        action='store_true', help='Interface to modify a user (role, email)')
    parser.add_argument('-d', '--delete-user', dest='delete_user',
                        action='store_true', help='Interface to delete a user.')
    parser.add_argument('-i', '--invite')
    parser.add_argument('-l', '--list', action='store_true')
    parser.add_argument('-b', '--backlog')
    parser.add_argument('--check', help="check if username exists")
    parser.add_argument('-u', '--users', action="store_true", help="list all existing users")

    r = parser.parse_args(args=args)
    m = CLIUserManager()

    if r.backlog:
        do_invite_backlog(m, r.backlog)
    elif r.list:
        list_not_invited(m, r.invite_all)
    elif r.invite:
        do_invite(m, r.invite)
    elif r.create_user is not None:
        m.create_user(*r.create_user)
    elif r.modify_user:
        m.modify_user()
    elif r.delete_user:
        m.delete_user()
    elif r.check:
        m.check_user(r.check)
    elif r.users:
        m.list_users()
    else:
        print('All systems go! See --help for usage')


def list_not_invited(m, invite=False):
    invites = RedisTable(m.redis, 'h:invites')
    for email, v in iteritems(invites):
        if 'sent' not in v:
            if invite:
                do_invite(m, email)
            print((email + ': ' + v.get('name', '') + ' -- ' + v.get('desc', '')))


def do_invite(m, email, email_template='webrecorder/templates/emailinvite.html'):
    res = m.send_invite(email,
                        email_template=email_template,
                        host='https://webrecorder.io')
    if res:
        print('Success')
    else:
        print('Fail')

    time.sleep(1)


def do_invite_backlog(m, filename):
    users = m.get_users()
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
            for n, v in iteritems(users):
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
