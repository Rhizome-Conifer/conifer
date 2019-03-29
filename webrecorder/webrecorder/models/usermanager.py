import os
import re
import base64
import hashlib
import json
import redis
import requests

from datetime import datetime
from collections import OrderedDict
from os.path import expandvars

from getpass import getpass
from string import ascii_lowercase as alpha

from bottle import template, request
#from cork import AAAException

from webrecorder.webreccork import ValidationException, AuthException

from webrecorder.models.base import BaseAccess, DupeNameException
from webrecorder.models.user import User, UserTable

from webrecorder.utils import load_wr_config, sanitize_title, get_bool
from webrecorder.webreccork import WebRecCork
from webrecorder.redisutils import RedisTable


# ============================================================================
class UserManager(object):
    USER_RX = re.compile(r'^[A-Za-z0-9][\w-]{2,30}$')

    RESTRICTED_NAMES = ['login', 'logout', 'user', 'admin', 'manager', 'coll', 'collection',
                        'guest', 'settings', 'profile', 'api', 'anon', 'webrecorder',
                        'anonymous', 'register', 'join', 'download', 'live', 'embed']

    PASS_RX = re.compile(r'^(?=.*[\d\W])(?=.*[a-z])(?=.*[A-Z]).{8,}$')

    LC_USERNAMES_KEY = 'h:lc_users'

    def __init__(self, redis, cork, config):
        self.redis = redis
        self.cork = cork
        self.config = config

        self.default_coll = config['default_coll']

        self.temp_prefix = config['temp_prefix']

        mailing_list = os.environ.get('MAILING_LIST', '').lower()
        self.mailing_list = mailing_list in ('true', '1', 'yes')
        self.default_list_endpoint = os.environ.get('MAILING_LIST_ENDPOINT', '')
        self.list_key = os.environ.get('MAILING_LIST_KEY', '')
        self.list_removal_endpoint = os.path.expandvars(
                                        os.environ.get('MAILING_LIST_REMOVAL', ''))
        self.payload = os.environ.get('MAILING_LIST_PAYLOAD', '')
        self.remove_on_delete = (os.environ.get('REMOVE_ON_DELETE', '')
                                 in ('true', '1', 'yes'))

        self.announce_list = os.environ.get('ANNOUNCE_MAILING_LIST_ENDPOINT', False)
        invites = expandvars(config.get('invites_enabled', 'true')).lower()
        self.invites_enabled = invites in ('true', '1', 'yes')

        try:
            self.redis.hsetnx('h:defaults', 'max_size', int(config['default_max_size']))
            self.redis.hsetnx('h:defaults', 'max_anon_size', int(config['default_max_anon_size']))
        except Exception as e:
            print('WARNING: Unable to init defaults: ' + str(e))

        self.all_users = UserTable(self.redis, self._get_access)

        self.invites = RedisTable(self.redis, 'h:invites')

    def register_user(self, input_data, host):
        msg = OrderedDict()
        redir_extra = ''

        username = input_data.get('username', '')
        full_name = input_data.get('full_name', '')
        email = input_data.get('email', '')

        if 'username' not in input_data:
            msg['username'] = 'Missing Username'

        elif username.startswith(self.temp_prefix):
            msg['username'] = 'Sorry, this is not a valid username'

        if 'email' not in input_data:
            msg['email'] = 'Missing Email'

        if self.invites_enabled:
            try:
                val_email = self.is_valid_invite(input_data['invite'])
                if val_email != email:
                    raise ValidationException('Sorry, this invite can only be used with email: {0}'.format(val_email))
            except ValidationException as ve:
                msg['invite'] = str(ve)

            else:
                redir_extra = '?invite=' + input_data.get('invite', '')

        try:
            self.validate_user(username, email)
            self.validate_password(input_data['password'], input_data['confirmpassword'])

        except ValidationException as ve:
            msg['validation'] = str(ve)

        try:
            move_info = self.get_move_temp_info(input_data)
        except ValidationException as ve:
            msg['move_info'] = str(ve)

        if msg:
            return msg, redir_extra


        try:
            desc = {'name': full_name}

            if move_info:
                desc['move_info'] = move_info

            desc = json.dumps(desc)

            self.cork.register(username, input_data['password'], email, role='archivist',
                          max_level=50,
                          subject='webrecorder.io Account Creation',
                          email_template='webrecorder/templates/emailconfirm.html',
                          description=desc,
                          host=host)

            # add to announce list if user opted in
            if input_data.get('announce_mailer') and self.announce_list:
                self.add_to_mailing_list(username, email, full_name,
                                         list_endpoint=self.announce_list)

            if self.invites_enabled:
                self.delete_invite(email)

            # extend session for upto 90 mins to store data to be migrated
            # to allow time for user to validate registration
            if move_info:
                self.get_session().save()

        except ValidationException as ve:
            msg['validation'] = str(ve)

        except Exception as ex:
            import traceback
            traceback.print_exc()
            msg['other_error'] = 'Registration failed: ' + str(ex)

        if not msg:
            msg['success'] = ('A confirmation e-mail has been sent to <b>{0}</b>. ' +
                              'Please check your e-mail to complete the registration!').format(username)

        return msg, redir_extra

    def get_move_temp_info(self, input_data):
        move_temp = input_data.get('moveTemp')

        if not move_temp:
            return None

        to_coll_title = input_data.get('toColl', '')
        to_coll = sanitize_title(to_coll_title)

        if not to_coll:
            raise ValidationException('invalid_coll_name')


        if not self.access.session_user.is_anon():
            raise ValidationException('invalid_user_import')

        return {'from_user': self.access.session_user.name,
                'to_coll': to_coll,
                'to_title': to_coll_title,
               }

    def validate_registration(self, reg_code, cookie, username):
        cookie_validate = 'valreg=' + reg_code

        if cookie_validate not in cookie:
            return {'error': 'invalid_code'}

        try:
            user, first_coll = self.create_user_from_reg(reg_code, username)

            return {'registered': user.name,
                    'first_coll_name': first_coll.name}

        except ValidationException as ve:
            return {'error': ve.msg}

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'error': 'invalid_code'}

    def find_case_insensitive_username(self, username):
        lower_username = username.lower()

        new_username = self.redis.hget(self.LC_USERNAMES_KEY,  lower_username)
        if new_username == '-' or new_username == username or new_username is None:
            return None

        if new_username == '':
            return lower_username

        return new_username

    def login_user(self, input_data):
        """Authenticate users"""
        username = input_data.get('username', '')
        password = input_data.get('password', '')

        try:
            move_info = self.get_move_temp_info(input_data)
        except ValidationException as ve:
            return {'error': str(ve)}

        # first, authenticate the user
        # if failing, see if case-insensitive username and try that
        if not self.cork.is_authenticate(username, password):
            username = self.find_case_insensitive_username(username)
            if not username or not self.cork.is_authenticate(username, password):
                return {'error': 'invalid_login'}

        # if not enough space, don't continue with login
        if move_info:
            if not self.has_space_for_new_collection(username,
                                                     move_info['from_user'],
                                                    'temp'):
                #return {'error': 'Sorry, not enough space to import this Temporary Collection into your account.'}
                return {'error': 'out_of_space'}

        user = self.all_users[username]
        new_collection = None

        try:
            if move_info:
                new_collection = self.move_temp_coll(user, move_info)
        except DupeNameException as de:
            return {'error': 'duplicate_name'}
            #return {'error': 'Collection "{0}" already exists'.format(move_info['to_title'])}

        remember_me = get_bool(input_data.get('remember_me'))

        # login session and access system
        self.access.log_in(username, remember_me)

        user.update_last_login()

        return {'success': '1',
                'new_coll_name': new_collection.name if new_collection else None,
                'user': user}

    def logout(self):
        sesh = self.get_session()
        sesh.delete()
        return

    def has_user_email(self, email):
        #TODO: implement a email table, if needed?

        for n, user_data in self.all_users.items():
            if user_data['email_addr'] == email:
                return True

        return False

    def get_user_email(self, user):
        if not user:
            return ''

        try:
            user_data = self.all_users[user]
        except:
            user_data = None

        if user_data:
            return user_data.get('email_addr', '')
        else:
            return ''

    def is_username_available(self, username):
        username_lc = username.lower()

        # username matches of the restricted names
        if username_lc in self.RESTRICTED_NAMES:
            return False

        # username doesn't match the allowed regex
        if not self.USER_RX.match(username):
            return False

        # lowercase username already exists
        if self.redis.hexists(self.LC_USERNAMES_KEY, username_lc):
            return False

        # username already exists! (shouldn't match if lowercase exists, but just in case)
        if username in self.all_users:
            return False

        return True

    def validate_user(self, user, email):
        if not self.is_username_available(user):
            raise ValidationException('username_not_available')

        if self.has_user_email(email):
            raise ValidationException('email_not_available')

        return True

    def validate_password(self, password, confirm):
        if password != confirm:
            raise ValidationException('password_mismatch')

        if not self.PASS_RX.match(password):
            raise ValidationException('password_invalid')

        return True

    def _get_access(self):
        return request['webrec.access']

    @property
    def access(self):
        return self._get_access()

    def get_roles(self):
        return [x for x in self.cork._store.roles]

    def get_user_coll(self, username, coll_name):
        try:
            user = self.all_users[username]
        except:
            return None, None

        collection = user.get_collection_by_name(coll_name)
        return user, collection

    def get_user_coll_rec(self, username, coll_name, rec):
        user, collection = self.get_user_coll(username, coll_name)
        if collection:
            recording = collection.get_recording(rec)
        else:
            recording = None

        return user, collection, recording

    def update_password(self, curr_password, password, confirm):
        username = self.access.session_user.name

        if not self.cork.verify_password(username, curr_password):
            raise ValidationException('invalid_password')

        self.validate_password(password, confirm)

        self.cork.update_password(username, password)

    def reset_password(self, password, confirm, resetcode):
        self.validate_password(password, confirm)

        try:
            self.cork.reset_password(resetcode, password)
        except AuthException:
            raise ValidationException('invalid_reset_code')

    def is_valid_invite(self, invitekey):
        try:
            if not invitekey:
                return False

            key = base64.b64decode(invitekey.encode('utf-8')).decode('utf-8')
            key.split(':', 1)
            email, hash_ = key.split(':', 1)

            entry = self.invites[email]

            if entry and entry.get('hash_') == hash_:
                return email
        except Exception as e:
            print(e)
            pass

        msg = 'Sorry, that is not a valid invite code. Please try again or request another invite'
        raise ValidationException(msg)

    def delete_invite(self, email):
        try:
            archive_invites = RedisTable(self.redis, 'h:arc_invites')
            archive_invites[email] = self.invites[email]
        except:
            pass

        del self.invites[email]

    def save_invite(self, email, name, desc=''):
        if not email or not name:
            return False

        self.invites[email] = {'name': name, 'email': email, 'reg_data': desc}
        return True

    def send_invite(self, email, email_template, host):
        entry = self.invites[email]
        if not entry:
            print('No Such Email In Invite List')
            return False

        hash_ = base64.b64encode(os.urandom(21)).decode('utf-8')
        entry['hash_'] = hash_

        full_hash = email + ':' + hash_
        invitekey = base64.b64encode(full_hash.encode('utf-8')).decode('utf-8')

        email_text = template(
            email_template,
            host=host,
            email_addr=email,
            name=entry.get('name', email),
            invite=invitekey,
        )
        self.cork.mailer.send_email(email, 'You are invited to join webrecorder.io beta!', email_text)
        entry['sent'] = str(datetime.utcnow())
        return True

    def add_to_mailing_list(self, username, email, name, list_endpoint=None):
        """3rd party mailing list subscription"""
        if not (list_endpoint or self.default_list_endpoint) or not self.list_key:
            print('MAILING_LIST is turned on, but required fields are '
                  'missing.')
            return

        # if no endpoint provided, use default
        if list_endpoint is None:
            list_endpoint = self.default_list_endpoint

        try:
            res = requests.post(list_endpoint,
                                auth=('nop', self.list_key),
                                data=self.payload.format(
                                    email=email,
                                    name=name,
                                    username=username),
                                timeout=1.5)

            if res.status_code != 200:
                print('Unexpected mailing list API response.. '
                      'status code: {0.status_code}\n'
                      'content: {0.content}'.format(res))

        except Exception as e:
            if e is requests.exceptions.Timeout:
                print('Mailing list API timed out..')
            else:
                print('Adding to mailing list failed:', e)

    def remove_from_mailing_list(self, email):
        """3rd party mailing list removal"""
        if not self.list_removal_endpoint or not self.list_key:
            # fail silently, log info
            print('REMOVE_ON_DELETE is turned on, but required '
                  'fields are missing.')
            return

        try:
            email = email.encode('utf-8').lower()
            email_hash = hashlib.md5(email).hexdigest()
            res = requests.delete(self.list_removal_endpoint.format(email_hash),
                                  auth=('nop', self.list_key),
                                  timeout=1.5)

            if res.status_code != 204:
                print('Unexpected mailing list API response.. '
                      'status code: {0.status_code}\n'
                      'content: {0.content}'.format(res))

        except Exception as e:
            if e is requests.exceptions.Timeout:
                print('Mailing list API timed out..')
            else:
                print('Removing from mailing list failed:', e)

    def get_session(self):
        return request.environ['webrec.session']

    def create_new_user(self, username, init_info=None):
        init_info = init_info or {}

        user = self.all_users.make_user(username)
        user.create_new()

        # track lowercase username
        lower_username = username.lower()
        self.redis.hset(self.LC_USERNAMES_KEY, lower_username,
                        username if lower_username != username else '')

        first_coll = None

        move_info = init_info.get('move_info')
        if move_info:
            first_coll = self.move_temp_coll(user, move_info)

        elif self.default_coll:
            first_coll = user.create_collection(self.default_coll['id'],
                                   title=self.default_coll['title'],
                                   desc=self.default_coll['desc'].format(username),
                                   public=False)

        # email subscription set up?
        if self.mailing_list:
            name = init_info.get('name', '')
            self.add_to_mailing_list(username, user['email_addr'], name)

        return user, first_coll

    def create_user_as_admin(self, email, username, passwd, passwd2, role, name):
        """Create a new user with command line arguments or series of prompts,
           preforming basic validation
        """
        self.access.assert_is_superuser()

        errs = []

        # EMAIL
        # validate email
        if not re.match(r'[\w.-/+]+@[\w.-]+.\w+', email):
            errs.append('valid email required!')

        if email in [data['email_addr'] for u, data in self.all_users.items()]:
            errs.append('A user already exists with {0} email!'.format(email))

        # USERNAME
        # validate username
        if not username:
            errs.append('please specify a username!')

        if not self.is_username_available(username):
            errs.append('Invalid username.')

        # ROLE
        if role not in self.get_roles():
            errs.append('Not a valid role.')

        # PASSWD
        if passwd != passwd2 or not self.PASS_RX.match(passwd):
            errs.append('Passwords must match and be at least 8 characters long '
                        'with lowercase, uppercase, and either digits or symbols.')

        if errs:
            return errs, None

        # add user to cork
        #self.cork._store.users[username] = {
        self.all_users[username] = {
            'role': role,
            'hash': self.cork._hash(username, passwd).decode('ascii'),
            'email_addr': email,
            'full_name': name,
            'creation_date': str(datetime.utcnow()),
            'last_login': str(datetime.utcnow()),
        }
        #self.cork._store.save_users()

        return None, self.create_new_user(username, {'email': email,
                                                     'name': name})
    def create_user_from_reg(self, reg, username):
        user, init_info = self.cork.validate_registration(reg, username)

        if init_info:
            init_info = json.loads(init_info)

        user, first_coll = self.create_new_user(user, init_info)

        # login here
        self.access.log_in(user.name, remember_me=False)

        return user, first_coll

    def update_user_as_admin(self, user, data):
        """ Update any property on specified user
        For admin-only
        """
        self.access.assert_is_curr_user(user)

        errs = []

        if not data:
            errs.append('Nothing To Update')

        if 'role' in data and data['role'] not in self.get_roles():
            errs.append('Not a valid role.')

        if 'max_size' in data and not isinstance(data['max_size'], int):
            errs.append('max_size must be an int')

        if errs:
            return errs

        if 'name' in data:
            #user['desc'] = '{{"name":"{name}"}}'.format(name=data.get('name', ''))
            user['name'] = data.get('name', '')

        if 'desc' in data:
            user['desc'] = data['desc']

        if 'max_size' in data:
            user['max_size'] = data['max_size']

        if 'role' in data:
            user['role'] = data['role']

        return None

    def delete_user(self, username):
        try:
            user = self.all_users[username]
            self.access.assert_is_curr_user(user)
        except Exception:
            return False

        if self.mailing_list and self.remove_on_delete:
            self.remove_from_mailing_list(user['email_addr'])

        # remove user and from all users table
        del self.all_users[username]

        try:
            self.get_session().delete()
        except Exception:
            pass

        return True

    def has_space_for_new_collection(self, to_username, from_username, coll_name):
        try:
            to_user = self.all_users[to_username]
        except:
            return False

        from_user = self.all_users[from_username]
        collection = from_user.get_collection_by_name(coll_name)
        if not collection:
            return False

        return (collection.size <= to_user.get_size_remaining())

    def move_temp_coll(self, user, move_info):
        from_user = self.all_users[move_info['from_user']]
        temp_coll = from_user.get_collection_by_name('temp')
        if not from_user.move(temp_coll, move_info['to_coll'], user):
            return None

        temp_coll.set_prop('title', move_info['to_title'])

        # don't delete data in temp user dir as its waiting to be committed!
        self.get_session().set_anon_commit_wait()

        for recording in temp_coll.get_recordings():
            # will be marked for commit
            recording.set_closed()

        return temp_coll


# ============================================================================
class CLIUserManager(UserManager):
    def __init__(self, redis_url=None):
        config = load_wr_config()

        self.base_access = BaseAccess()

        # Init Redis
        if not redis_url:
            redis_url = os.environ['REDIS_BASE_URL']

        r = redis.StrictRedis.from_url(redis_url, decode_responses=True)

        # Init Cork
        cork = WebRecCork.create_cork(r, config)

        super(CLIUserManager, self).__init__(
            redis=r,
            cork=cork,
            config=config)

    def create_user(self, email=None, username=None, passwd=None, role=None, name=None):
        """Create a new user with command line arguments or series of prompts,
           preforming basic validation
        """

        # EMAIL
        if not email:
            print('let\'s create a new user..')
            email = input('email: ').strip()

        # USERNAME
        if not username:
            username = input('username: ').strip()

        # NAME
        if not name:
            name = input('name (optional): ').strip()

        # ROLE
        if role not in self.get_roles():
            role = self.choose_role()

        # PASSWD
        if not passwd:
            passwd = getpass('password: ')
            passwd2 = getpass('repeat password: ')
        else:
            passwd2 = passwd

        errs, res = self.create_user_as_admin(email, username, passwd, passwd2, role, name)

        if errs:
            for err in errs:
                print(err)
            return

        print('Created user {username} with the email {email} and the role: '
          '\'{role}\''.format(username=username,
                              email=email,
                              role=role))

        return res

    def choose_role(self):
        """Flexible choice prompt for as many roles as the system has"""
        roles = [r for r in self.cork.list_roles()]
        formatted = ['{0} (level {1})'.format(*r) for r in roles]
        condensed = '\n'.join(['{0}.) {1}'.format(*t) for t in zip(alpha, formatted)])
        new_role = input('choose: \n{0}\n\n'.format(condensed))

        if new_role not in alpha[:len(roles)]:
            raise Exception('invalid role choice')

        return roles[alpha.index(new_role)][0]

    def modify_user(self):
        """Modify an existing users. available modifications: role, email"""
        username = input('username to modify: ')
        has_modified = False

        if username not in self.all_users:
            print('{0} doesn\'t exist'.format(username))
            return

        user = self.all_users[username]

        mod_role = input('change role? currently {0} (y/n) '.format(user['role']))
        if mod_role.strip().lower() == 'y':
            new_role = self.choose_role()
            user['role'] = new_role
            has_modified = True
            print('assigned {0} with the new role: {1}'.format(username, new_role))

        mod_email = input('update email? currently {0} (y/n) '.format(user['email_addr']))
        if mod_email.strip().lower() == 'y':
            new_email = input('new email: ')

            if not re.match(r'[\w.-/+]+@[\w.-]+.\w+', new_email):
                print('valid email required!')
                return

            if new_email in [data['email_addr'] for u, data in self.all_users.items()]:
                print('A user already exists with {0} email!'.format(new_email))
                return

            # assume the 3rd party mailing list doesn't support updating addresses
            # so if add & remove are turned on, remove the old and add the
            # new address.
            if self.mailing_list and self.remove_on_delete:
                self.remove_from_mailing_list(user['email_addr'])
                #name = json.loads(self.get_users()[username].get('desc', '{}')).get('name', '')
                name = user['name']
                self.add_to_mailing_list(username, new_email, name)

            user['email_addr'] = new_email
            print('assigned {0} with the new email: {1}'.format(username, new_email))
            has_modified = True

        #
        # additional modifications can be added here
        #

        #if has_modified:
        #    self.cork._store.save_users()

        print('All done!')

    def list_users(self):
        """List all existing users."""
        input_ = input(
            "{number} users, do you want to list users? (y/n)".format(
                number=len(self.all_users)
            )
        )
        if input_ == "Y" or input_ == "y":
            print(
                "\n".join(
                    "User {username}".format(username=user)
                    for user in self.all_users
                )
            )

    def check_user(self, username):
        """Check if username exists.

        :param str username: username
        """
        if username not in self.all_users:
            print("User {username} does not exist".format(username=username))
        else:
            print("User {username} exists".format(username=username))

    def delete_user(self):
        """Remove a user from the system"""
        username = input('username to delete: ')
        confirmation = input('** all data for the username `{0}` will be wiped! **\n'
                             'please type the username again to confirm: '.format(username))

        if username != confirmation:
            print('Username confirmation didn\'t match! Aborting..')
            return

        if username not in self.all_users:
            print('The username {0} doesn\'t exist..'.format(username))
            return

        print('removing {0}..'.format(username))

        super(CLIUserManager, self).delete_user(username)

    def _get_access(self):
        return self.base_access


