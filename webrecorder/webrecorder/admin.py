#!/usr/bin/env python

import json
import os
import re
import redis
import time

from argparse import ArgumentParser, RawTextHelpFormatter
from datetime import datetime
from getpass import getpass
from six import iteritems
from string import ascii_lowercase as alpha

from webrecorder.redisman import init_manager_for_cli
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

    r = parser.parse_args(args=args)
    m = init_manager_for_cli()

    if r.backlog:
        do_invite_backlog(m, r.backlog)
    elif r.list:
        list_not_invited(m, r.invite_all)
    elif r.invite:
        do_invite(m, r.invite)
    elif r.create_user is not None:
        create_user(m, *r.create_user)
    elif r.modify_user:
        modify_user(m)
    elif r.delete_user:
        delete_user(m)
    else:
        print('All systems go! See --help for usage')


def choose_role(m):
    """Flexible choice prompt for as many roles as the system has"""
    roles = [r for r in m.cork.list_roles()]
    formatted = ['{0} (level {1})'.format(*r) for r in roles]
    condensed = '\n'.join(['{0}.) {1}'.format(*t) for t in zip(alpha, formatted)])
    new_role = input('choose: \n{0}\n\n'.format(condensed))

    if new_role not in alpha[:len(roles)]:
        raise Exception('invalid role choice')

    return roles[alpha.index(new_role)][0]


def create_user(m, email=None, username=None, passwd=None, role=None, name=None):
    """Create a new user with command line arguments or series of prompts,
       preforming basic validation
    """
    users = m.get_users()

    if not email:
        print('let\'s create a new user..')
        email = input('email: ').strip()

    # validate email
    if not re.match(r'[\w.-/+]+@[\w.-]+.\w+', email):
        print('valid email required!')
        return

    if email in [data['email_addr'] for u, data in users.items()]:
        print('A user already exists with {0} email!'.format(email))
        return

    username = username or input('username: ').strip()

    # validate username
    if not username:
        print('please enter a username!')
        return

    if not m.USER_RX.match(username) or username in m.RESTRICTED_NAMES:
        print('Invalid username..')
        return

    if username in users:
        print('Username already exists..')
        return

    name = name if name is not None else input('name (optional): ').strip()

    role = role if role in [r[0] for r in m.cork.list_roles()] else choose_role(m)

    if passwd is not None:
        passwd2 = passwd
    else:
        passwd = getpass('password: ')
        passwd2 = getpass('repeat password: ')

    if passwd != passwd2 or not m.PASS_RX.match(passwd):
        print('Passwords must match and be at least 8 characters long '
                     'with lowercase, uppercase, and either digits or symbols.')
        return

    print('Creating user {username} with the email {email} and the role: '
          '\'{role}\''.format(username=username,
                              email=email,
                              role=role))

    # add user to cork
    m.cork._store.users[username] = {
        'role': role,
        'hash': m.cork._hash(username, passwd).decode('ascii'),
        'email_addr': email,
        'desc': '{{"name":"{name}"}}'.format(name=name),
        'creation_date': str(datetime.utcnow()),
        'last_login': str(datetime.utcnow()),
    }
    m.cork._store.save_users()

    # add user account defaults
    key = m.user_key.format(user=username)
    now = int(time.time())

    max_size, max_coll = m.redis.hmget('h:defaults', ['max_size', 'max_coll'])
    if not max_size:
        max_size = m.default_max_size

    if not max_coll:
        max_coll = m.default_max_coll

    with redis_pipeline(m.redis) as pi:
        pi.hset(key, 'max_size', max_size)
        pi.hset(key, 'max_coll', max_coll)
        pi.hset(key, 'created_at', now)
        pi.hset(key, 'name', name)
        pi.hsetnx(key, 'size', '0')

    if m.default_coll:
        # create initial collection
        m.create_collection(username,
                            coll=m.default_coll['id'],
                            coll_title=m.default_coll['title'],
                            desc=m.default_coll['desc'].format(username),
                            public=False)

    # email subscription set up?
    if m.mailing_list:
        m.add_to_mailing_list(username, email, name)

    print('All done!')


def modify_user(m):
    """Modify an existing users. available modifications: role, email"""
    users = m.get_users()

    username = input('username to modify: ')
    has_modified = False

    if username not in users:
        print('{0} doesn\'t exist'.format(username))
        return

    mod_role = input('change role? currently {0} (y/n) '.format(users[username]['role']))
    if mod_role.strip().lower() == 'y':
        new_role = choose_role(m)
        m.cork._store.users[username]['role'] = new_role
        has_modified = True
        print('assigned {0} with the new role: {1}'.format(username, new_role))

    mod_email = input('update email? currently {0} (y/n) '.format(users[username]['email_addr']))
    if mod_email.strip().lower() == 'y':
        new_email = input('new email: ')

        if not re.match(r'[\w.-/+]+@[\w.-]+.\w+', new_email):
            print('valid email required!')
            return

        if new_email in [data['email_addr'] for u, data in users.items()]:
            print('A user already exists with {0} email!'.format(new_email))
            return

        # assume the 3rd party mailing list doesn't support updating addresses
        # so if add & remove are turned on, remove the old and add the
        # new address.
        if m.mailing_list and m.remove_on_delete:
            m.remove_from_mailing_list(users[username]['email_addr'])
            name = json.loads(m.get_users()[username].get('desc', '{}')).get('name', '')
            m.add_to_mailing_list(username, new_email, name)

        print('assigned {0} with the new email: {1}'.format(username, new_email))
        m.cork._store.users[username]['email_addr'] = new_email
        has_modified = True

    #
    # additional modifications can be added here
    #

    if has_modified:
        m.cork._store.save_users()

    print('All done!')


def delete_user(m):
    """Remove a user from the system"""
    users = m.get_users()
    remove_on_delete = (os.environ.get('REMOVE_ON_DELETE', '')
                        in ('true', '1', 'yes'))

    username = input('username to delete: ')
    confirmation = input('** all data for the username `{0}` will be wiped! **\n'
                         'please type the username again to confirm: '.format(username))

    if username != confirmation:
        print('Username confirmation didn\'t match! Aborting..')
        return

    if username not in users:
        print('The username {0} doesn\'t exist..'.format(username))
        return

    print('removing {0}..'.format(username))

    # email subscription set up?
    if remove_on_delete:
        m.remove_from_mailing_list(users[username]['email_addr'])

    # delete user data and remove from redis
    res = m._send_delete('user', username)

    if res:
        # delete user from cork
        m.cork.user(username).delete()


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
