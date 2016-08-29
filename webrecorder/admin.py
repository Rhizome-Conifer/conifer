#!/usr/bin/env python

import hashlib
import json
import os
import re
import redis
import requests
import time

from argparse import ArgumentParser, RawTextHelpFormatter
from datetime import datetime
from getpass import getpass
from six import iteritems
from string import ascii_lowercase as alpha

from webrecorder.redisman import init_manager_for_cli
from webrecorder.redisutils import RedisTable


def main():
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
    parser.add_argument('-a', '--invite-all', action='store_true', default=False)

    r = parser.parse_args()
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


def add_email(username, email, name):
    """3rd party mailing list subscription"""
    list_endpoint = os.environ.get('MAILING_LIST_ENDPOINT', '')
    list_key = os.environ.get('MAILING_LIST_KEY', '')
    payload = os.environ.get('MAILING_LIST_PAYLOAD', '')

    if not list_endpoint or not list_key:
        return print('MAILING_LIST is turned on, but required fields are '
                     'missing.')

    try:
        res = requests.post(list_endpoint,
                            auth=('nop', list_key),
                            data=payload.format(
                                email=email,
                                name=name,
                                username=username))

        if res.status_code != 200:
            print('Unexpected mailing list API response.. '
                  'status code: {0.status_code}\n'
                  'content: {0.content}'.format(res))

    except Exception as e:
        print('Adding to mailing list failed:', e)


def remove_email(email):
    """3rd party mailing list removal"""
    list_key = os.environ.get('MAILING_LIST_KEY', '')
    list_removal_endpoint = os.path.expandvars(
                                os.environ.get('MAILING_LIST_REMOVAL', ''))
    try:
        email = email.encode('utf-8').lower()
        email_hash = hashlib.md5(email).hexdigest()
        res = requests.delete(list_removal_endpoint.format(email_hash),
                              auth=('nop', list_key))

        if res.status_code != 204:
            print('Unexpected mailing list API response.. '
                  'status code: {0.status_code}\n'
                  'content: {0.content}'.format(res))

    except Exception as e:
        print('Removing from mailing list failed:', e)


def create_user(m, email=None, username=None, passwd=None, role=None, name=None):
    """Create a new user with command line arguments or series of prompts,
       preforming basic validation
    """
    users = m.get_users()
    mailing_list = os.environ.get('MAILING_LIST', '').lower()
    mailing_list = mailing_list in ('true', '1', 'yes')

    print('let\'s create a new user..')
    email = email or input('email: ').strip()

    # validate email
    if not re.match(r'[\w.-/+]+@[\w.-]+.\w+', email):
        return print('valid email required!')

    if email in [data['email_addr'] for u, data in users.items()]:
        return print('A user already exists with {0} email!'.format(email))

    username = username or input('username: ').strip()

    # validate username
    if not username:
        return print('please enter a username!')

    if not m.USER_RX.match(username) or username in m.RESTRICTED_NAMES:
        return print('Invalid username..')

    if username in users:
        return print('Username already exists..')

    name = name if name is not None else input('name (optional): ').strip()

    role = role if role in [r[0] for r in m.cork.list_roles()] else choose_role(m)

    if passwd is not None:
        passwd2 = passwd
    else:
        passwd = getpass('password: ')
        passwd2 = getpass('repeat password: ')

    if passwd != passwd2 or not m.PASS_RX.match(passwd):
        return print('Passwords must match and be at least 8 characters long '
                     'with lowercase, uppercase, and either digits or symbols.')

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

    with redis.utils.pipeline(m.redis) as pi:
        pi.hset(key, 'max_size', max_size)
        pi.hset(key, 'max_coll', max_coll)
        pi.hset(key, 'created_at', now)
        pi.hset(key, 'name', name)
        pi.hsetnx(key, 'size', '0')

    # create initial collection
    m.create_collection(username,
                        coll=m.default_coll['id'],
                        coll_title=m.default_coll['title'],
                        desc=m.default_coll['desc'].format(username),
                        public=False,
                        synthetic=True)

    # email subscription set up?
    if mailing_list:
        add_email(username, email, name)

    print('All done!')


def modify_user(m):
    """Modify an existing users. available modifications: role, email"""
    users = m.get_users()
    mailing_list = os.environ.get('MAILING_LIST', '').lower()
    mailing_list = mailing_list in ('true', '1', 'yes')
    remove_on_delete = (os.environ.get('REMOVE_ON_DELETE', '')
                        in ('true', '1', 'yes'))

    username = input('username to modify: ')
    has_modified = False

    if username not in users:
        return print('{0} doesn\'t exist'.format(username))

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
            return print('valid email required!')

        if new_email in [data['email_addr'] for u, data in users.items()]:
            return print('A user already exists with {0} email!'.format(new_email))

        # assume the 3rd party mailing list doesn't support updating addresses
        # so if add & remove are turned on, remove the old and add the
        # new address.
        if mailing_list and remove_on_delete:
            remove_email(users[username]['email_addr'])
            name = json.loads(m.get_users()[username].get('desc', '{}')).get('name', '')
            add_email(username, new_email, name)

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
        return print('Username confirmation didn\'t match! Aborting..')

    if username not in users:
        return print('The username {0} doesn\'t exist..'.format(username))

    print('removing {0}..'.format(username))

    # email subscription set up?
    if remove_on_delete:
        remove_email(users[username]['email_addr'])

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
