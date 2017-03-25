import six
import time
import redis
import re
import json
import os
import base64
import hashlib

from datetime import datetime

from bottle import template, request, HTTPError

from webrecorder.webreccork import ValidationException
from webrecorder.redisutils import RedisTable
from webrecorder.webreccork import WebRecCork
from webrecorder.session import Session

from cork import AAAException

from six.moves.urllib.parse import quote

from pywb.utils.canonicalize import calc_search_range
from pywb.cdx.cdxobject import CDXObject

from warcio.timeutils import timestamp_now

from webrecorder.utils import load_wr_config, redis_pipeline

import requests


# ============================================================================
class LoginManagerMixin(object):
    USER_RX = re.compile(r'^[A-Za-z0-9][\w-]{2,30}$')

    RESTRICTED_NAMES = ['login', 'logout', 'user', 'admin', 'manager',
                        'guest', 'settings', 'profile', 'api', 'anon',
                        'anonymous', 'register', 'join', 'download', 'live', 'embed']

    PASS_RX = re.compile(r'^(?=.*[\d\W])(?=.*[a-z])(?=.*[A-Z]).{8,}$')

    def __init__(self, config):
        super(LoginManagerMixin, self).__init__(config)
        try:
            self.default_max_size = int(config['default_max_size'])
            self.default_max_anon_size = int(config['default_max_anon_size'])
            self.default_max_coll = int(config['default_max_coll'])

            if not self.redis.exists('h:defaults'):
                self.redis.hset('h:defaults', 'max_size', self.default_max_size)
                self.redis.hset('h:defaults', 'max_anon_size', self.default_max_anon_size)
                self.redis.hset('h:defaults', 'max_coll', self.default_max_coll)
        except Exception as e:
            print('WARNING: Unable to init defaults: ' + str(e))

        self.user_key = config['info_key_templ']['user']
        self.user_skip_key = config['skip_key_templ']
        self.skip_key_secs = int(config['skip_key_secs'])

        self.rename_url_templ = config['url_templates']['rename']

        self.default_coll = config['default_coll']

        self.temp_prefix = config['temp_prefix']

        mailing_list = os.environ.get('MAILING_LIST', '').lower()
        self.mailing_list = mailing_list in ('true', '1', 'yes')
        self.list_endpoint = os.environ.get('MAILING_LIST_ENDPOINT', '')
        self.list_key = os.environ.get('MAILING_LIST_KEY', '')
        self.list_removal_endpoint = os.path.expandvars(
                                        os.environ.get('MAILING_LIST_REMOVAL', ''))
        self.payload = os.environ.get('MAILING_LIST_PAYLOAD', '')
        self.remove_on_delete = (os.environ.get('REMOVE_ON_DELETE', '')
                                 in ('true', '1', 'yes'))

    def add_to_mailing_list(self, username, email, name):
        """3rd party mailing list subscription"""
        if not self.list_endpoint or not self.list_key:
            print('MAILING_LIST is turned on, but required fields are '
                  'missing.')
            return

        try:
            res = requests.post(self.list_endpoint,
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

    def get_users(self):
        return RedisTable(self.redis, 'h:users')

    def create_user(self, reg):
        try:
            user, init_info = self.cork.validate_registration(reg)
        except AAAException as a:
            raise ValidationException(a)

        if init_info:
            init_info = json.loads(init_info)
        else:
            init_info = {}

        key = self.user_key.format(user=user)
        now = int(time.time())

        max_size, max_coll = self.redis.hmget('h:defaults', ['max_size', 'max_coll'])
        if not max_size:
            max_size = self.default_max_size

        if not max_coll:
            max_coll = self.default_max_coll

        with redis_pipeline(self.redis) as pi:
            pi.hset(key, 'max_size', max_size)
            pi.hset(key, 'max_coll', max_coll)
            pi.hset(key, 'created_at', now)
            pi.hset(key, 'name', init_info.get('name', ''))
            pi.hsetnx(key, 'size', '0')

        self.cork.do_login(user)
        sesh = self.get_session()
        if not sesh.curr_user:
            sesh.curr_user = user

        # Move Temp collection to be permanent
        move_info = init_info.get('move_info')
        if move_info:
            self.move_temp_coll(user, move_info)

            first_coll = init_info.get('to_title')

        else:
            self.create_collection(user,
                                   coll=self.default_coll['id'],
                                   coll_title=self.default_coll['title'],
                                   desc=self.default_coll['desc'].format(user),
                                   public=False)

            first_coll = self.default_coll['title']

        # Check for mailing list management
        if self.mailing_list:
            self.add_to_mailing_list(user,
                                     self.get_user_email(user),
                                     self.get_user_info(user).get('name', ''))

        return user, first_coll

    def _create_anon_user(self, user):
        max_size = self.redis.hget('h:defaults', 'max_anon_size')
        if not max_size:
            max_size = self.default_max_anon_size

        key = self.user_key.format(user=user)
        now = int(time.time())

        with redis_pipeline(self.redis) as pi:
            pi.hset(key, 'max_size', max_size)
            pi.hset(key, 'max_coll', 1)
            pi.hset(key, 'created_at', now)
            pi.hsetnx(key, 'size', '0')

    def get_user_info(self, user):
        key = self.user_key.format(user=user)
        result = self._format_info(self.redis.hgetall(key))
        return result

    def has_user(self, user):
        return self.cork.user(user) is not None

    def get_anon_user(self, save_sesh=True):
        sesh = self.get_session()
        if not sesh.is_anon() and save_sesh:
            sesh.set_anon()
            self._create_anon_user(sesh.anon_user)

        return sesh.anon_user

    def set_user_desc(self, user, desc):
        self.assert_user_is_owner(user)

        key = self.user_key.format(user=user)

        self.redis.hset(key, 'desc', desc)

    def delete_user(self, user):
        if not self.is_anon(user) and not self.is_superuser():
            self.assert_user_is_owner(user)

        # Check for mailing list & removal endpoint
        if self.mailing_list and self.remove_on_delete:
            self.remove_from_mailing_list(self.get_user_email(user))

        res = self._send_delete('user', user)
        if res and not self.is_anon(user):
            # delete from cork!
            self.cork.user(user).delete()

        return res

    def get_size_allotment(self, user):
        user_key = self.user_key.format(user=user)
        return int(self.redis.hget(user_key, 'max_size')
                   or self.default_max_size)

    def get_size_usage(self, user):
        user_key = self.user_key.format(user=user)
        return int(self.redis.hget(user_key, 'size') or 0)

    def get_size_remaining(self, user):
        user_key = self.user_key.format(user=user)

        size, max_size = self.redis.hmget(user_key, ['size', 'max_size'])

        try:
            if not size:
                size = 0

            if not max_size:
                max_size = self.default_max_size

            max_size = int(max_size)
            size = int(size)
            rem = max_size - size
        except Exception as e:
            print(e)

        return rem

    def is_out_of_space(self, user):
        if not user:
            user = self.get_anon_user(False)
        elif not self.is_owner(user):
            return False

        return self.get_size_remaining(user) <= 0

    def has_user_email(self, email):
        #TODO: implement a email table, if needed?
        all_users = RedisTable(self.redis, 'h:users')
        for n, userdata in all_users.items():
            if userdata['email_addr'] == email:
                return True

        return False

    def get_user_email(self, user):
        if not user:
            return ''
        all_users = self.get_users()
        userdata = all_users[user]
        if userdata:
            return userdata.get('email_addr', '')
        else:
            return ''

    def validate_user(self, user, email):
        if self.has_user(user):
            msg = 'User <b>{0}</b> already exists! Please choose a different username'
            msg = msg.format(user)
            raise ValidationException(msg)

        if not self.USER_RX.match(user) or user in self.RESTRICTED_NAMES:
            msg = 'The name <b>{0}</b> is not a valid username. Please choose a different username'
            msg = msg.format(user)
            raise ValidationException(msg)

        if self.has_user_email(email):
            msg = 'There is already an account for <b>{0}</b>. If you have trouble logging in, you may <a href="/_forgot"><b>reset the password</b></a>.'
            msg = msg.format(email)
            raise ValidationException(msg)

        return True

    def validate_password(self, password, confirm):
        if password != confirm:
            raise ValidationException('Passwords do not match!')

        if not self.PASS_RX.match(password):
            raise ValidationException('Please choose a different password')

        return True

    def update_password(self, curr_password, password, confirm):
        user = self.get_curr_user()
        if not self.cork.verify_password(user, curr_password):
            raise ValidationException('Incorrect Current Password')

        self.validate_password(password, confirm)

        self.cork.update_password(user, password)

    def is_valid_invite(self, invitekey):
        try:
            if not invitekey:
                return False

            key = base64.b64decode(invitekey.encode('utf-8')).decode('utf-8')
            key.split(':', 1)
            email, hash_ = key.split(':', 1)

            table = RedisTable(self.redis, 'h:invites')
            entry = table[email]

            if entry and entry.get('hash_') == hash_:
                return email
        except Exception as e:
            print(e)
            pass

        msg = 'Sorry, that is not a valid invite code. Please try again or request another invite'
        raise ValidationException(msg)

    def delete_invite(self, email):
        table = RedisTable(self.redis, 'h:invites')
        try:
            archive_invites = RedisTable(self.redis, 'h:arc_invites')
            archive_invites[email] = table[email]
        except:
            pass
        del table[email]

    def save_invite(self, email, name, desc=''):
        if not email or not name:
            return False

        table = RedisTable(self.redis, 'h:invites')
        table[email] = {'name': name, 'email': email, 'desc': desc}
        return True

    def send_invite(self, email, email_template, host):
        table = RedisTable(self.redis, 'h:invites')
        entry = table[email]
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

    def skip_post_req(self, user, url):
        key = self.user_skip_key.format(user=user, url=url)
        r = self.redis.setex(key, self.skip_key_secs, 1)

    def rename(self, user, coll, new_coll, rec='*', new_rec='*',
               new_user='', title='', is_move=False):

        if not new_user:
            new_user = user

        self.assert_can_admin(new_user, new_coll)

        if is_move:
            if not self.has_collection(new_user, new_coll):
                return {'error_message': 'No Such Collection'}

        elif user != new_user or coll != new_coll:
            new_coll_info = self.create_collection(new_user, new_coll, title)
            title = new_coll_info['title']
            new_coll = new_coll_info['id']

        if rec != new_rec:
            new_rec_info = self.create_recording(new_user, new_coll, new_rec, title,
                                                 no_dupe=True)
            title = new_rec_info['title']
            new_rec = new_rec_info['id']

        if title:
            to_title = quote(title)
        else:
            to_title = ''

        rename_url = self.rename_url_templ.format(record_host=os.environ['RECORD_HOST'],
                                                  from_user=user,
                                                  from_coll=coll,
                                                  from_rec=rec,
                                                  to_user=new_user,
                                                  to_coll=new_coll,
                                                  to_rec=new_rec,
                                                  to_title=to_title)
        res = requests.get(rename_url)

        msg = res.json()

        if 'success' in msg:
            return {'coll_id': new_coll,
                    'rec_id': new_rec,
                    'title': title,
                   }

        else:
            return {'error_message': msg}

    def move_temp_coll(self, username, init_info):
        if not 'from_user' in init_info or not 'to_coll' in init_info:
            return None

        result = self.rename(user=init_info['from_user'],
                             coll='temp',
                             rec='*',
                             new_user=username,
                             new_coll=init_info['to_coll'],
                             new_rec='*',
                             title=init_info['to_title'])

        if result:
            return result['title']

    def has_space_for_new_coll(self, to_user, from_user, from_coll):
        size_remaining = self.get_size_remaining(to_user)

        new_size = self.get_collection_size(from_user, from_coll)

        return (new_size <= size_remaining)


# ============================================================================
class AccessManagerMixin(object):
    READ_PREFIX = 'r:'
    WRITE_PREFIX = 'w:'
    PUBLIC = '@public'

    def __init__(self, *args, **kwargs):
        super(AccessManagerMixin, self).__init__(*args, **kwargs)

        # custom cork auth decorators
        self.admin_view = self.cork.make_auth_decorator(role='admin',
                                                        fixed_role=True,
                                                        fail_redirect='/_login')
        self.auth_view = self.cork.make_auth_decorator(role='archivist',
                                                       fail_redirect='/_login')
        self.beta_user = self.cork.make_auth_decorator(role='beta-archivist',
                                                       fail_redirect='/_login')

    def is_anon(self, user):
        #return not user or user == '@anon' or user.startswith('anon/')
        if not user:
            return False

        sesh = self.get_session()

        return sesh.is_anon(user)

    def get_curr_user(self):
        sesh = self.get_session()
        return sesh.curr_user

    def _check_access(self, user, coll, type_prefix):
        # anon access
        if self.is_anon(user):
            return True

        sesh = self.get_session()
        curr_user = sesh.curr_user
        curr_role = sesh.curr_role

        # current user or superusers always have access, if collection exists
        if user == curr_user or (type_prefix == self.READ_PREFIX and curr_role == 'admin'):
            return self._has_collection_no_access_check(user, coll)

        key = self.coll_info_key.format(user=user, coll=coll)

        #role_key = self.ROLE_KEY.format(role=curr_role)

        if not curr_user:
            res = self.redis.hmget(key, type_prefix + self.PUBLIC)
        else:
            res = self.redis.hmget(key, type_prefix + self.PUBLIC,
                                        type_prefix + curr_user)

        return any(res)

    def is_public(self, user, coll):
        key = self.coll_info_key.format(user=user, coll=coll)
        res = self.redis.hget(key, self.READ_PREFIX + self.PUBLIC)
        return res == '1'

    def set_public(self, user, coll, is_public):
        if not self.is_superuser() and not self.can_admin_coll(user, coll):
            return False

        key = self.coll_info_key.format(user=user, coll=coll)

        if is_public:
            self.redis.hset(key, self.READ_PREFIX + self.PUBLIC, 1)
        else:
            self.redis.hdel(key, self.READ_PREFIX + self.PUBLIC)

        return True

    def can_read_coll(self, user, coll):
        return self._check_access(user, coll, self.READ_PREFIX)

    def can_write_coll(self, user, coll):
        return self._check_access(user, coll, self.WRITE_PREFIX)

    def can_mount_coll(self, user, coll):
        if not self.can_admin_coll(user, coll):
            return False

        try:
            self.cork.require(role='mounts-archivist')
            return True
        except Exception:
            return False

    # for now, equivalent to is_owner(), but a different
    # permission, and may change
    def can_admin_coll(self, user, coll):
        sesh = self.get_session()
        if sesh.is_restricted:
            return False

        if self.is_anon(user):
            return True

        return self.is_owner(user)

    def can_tag(self):
        """Same as `is_beta` for now, with the potential to break off
        """
        try:
            self.cork.require(role='beta-archivist')
            return True
        except Exception:
            return False

    def is_beta(self):
        try:
            self.cork.require(role='beta-archivist')
            return True
        except Exception:
            return False

    def is_superuser(self):
        """Test if logged in user has 100 level `admin` privledges.
           Named `superuser` to prevent confusion with `can_admin`
        """
        sesh = self.get_session()
        return sesh.curr_role == 'admin'

    def is_owner(self, user):
        sesh = self.get_session()
        if sesh.is_restricted:
            return False

        curr_user = self.get_curr_user()
        if not curr_user:
            return self.is_anon(user)

        return (user and user == curr_user)

    def assert_user_exists(self, user):
        if not self.has_user(user):
            raise HTTPError(404, 'No Such User')

    def assert_logged_in(self):
        try:
            self.cork.require(role='archivist')
        except Exception:
            raise HTTPError(404, 'Not Logged In')

    def assert_user_is_owner(self, user):
        self.assert_logged_in()
        if self.is_owner(user):
            return True

        raise HTTPError(404, 'No Such User')

    def assert_can_read(self, user, coll):
        if not self.can_read_coll(user, coll):
            raise HTTPError(404, 'No Read Access')
            #raise ValidationException('No Read Access')

    def assert_can_write(self, user, coll):
        if not self.can_write_coll(user, coll):
            raise HTTPError(404, 'No Write Access')
            #raise ValidationException('No Write Access')

    def assert_can_admin(self, user, coll):
        if not self.is_anon(user):
            self.assert_logged_in()

        if not self.can_admin_coll(user, coll):
            raise HTTPError(404, 'No Admin Access')
            #raise ValidationException('No Admin Access')


# ============================================================================
class PageManagerMixin(object):
    def __init__(self, config):
        super(PageManagerMixin, self).__init__(config)
        self.user_tag_templ = config['user_tag_templ']
        self.tags_key = config['tags_key']

    def tag_page(self, tags, user, coll, rec, pg_id):
        for tag in tags:
            k = self.user_tag_templ.format(user=user, coll=coll, rec=rec,
                                           tag=tag)
            if self.redis.exists(k):
                # if exists, untag
                if self.redis.sismember(k, pg_id):
                    self.redis.srem(k, pg_id)
                    self.redis.zincrby(self.tags_key, tag, -1)
                    continue

            # if not previously tagged or a new tag, set and add to tag count
            self.redis.sadd(k, pg_id)
            self.redis.zincrby(self.tags_key, tag)

    def get_pages_for_tag(self, tag):
        tagged_pages = []
        for k in self.redis.keys('*:tag:{}'.format(tag)):
            parts = k.split(':')
            user = parts[1]
            coll = parts[2]
            rec = parts[3]

            # display if owner or if collection is public
            if self.is_owner(user) or self.is_public(user, coll):
                for i in self.redis.smembers(k):
                    data = i.split(' ')
                    tagged_pages.append({
                        'user': user,
                        'collection': coll,
                        'recording': rec,
                        'timestamp': data[1],
                        'url': data[0],
                        'browser': data[2],
                    })

        return sorted(tagged_pages, key=lambda x: x['timestamp'])


# ============================================================================
class RecManagerMixin(object):
    def __init__(self, config):
        super(RecManagerMixin, self).__init__(config)
        self.rec_info_key = config['info_key_templ']['rec']
        self.rec_list_key = config['rec_list_key_templ']
        self.page_key = config['page_key_templ']
        self.cdx_key = config['cdxj_key_templ']
        self.tags_key = config['tags_key']

    def get_recording(self, user, coll, rec):
        self.assert_can_read(user, coll)

        key = self.rec_info_key.format(user=user, coll=coll, rec=rec)

        return self._fill_recording(user, coll, self.redis.hgetall(key))

    def _fill_recording(self, user, coll, data):
        result = self._format_info(data)

        if not result:
            return result

        rec = result.get('id')
        # an edge case where rec data is partially filled
        # considered not a valid recording, so skip
        if not rec:
            return None

        path = self.download_paths['rec']
        path = path.format(host=self.get_host(),
                           user=user,
                           coll=coll,
                           rec=rec)

        result['download_url'] = path

        #if result.get('pending_size') and result.get('size'):
        #    result['size'] = int(result['size']) + int(result['pending_size'])
        return result

    def has_recording(self, user, coll, rec):
        #self.assert_can_read(user, coll)
        if not self.can_read_coll(user, coll):
            return False

        key = self.rec_info_key.format(user=user, coll=coll, rec=rec)
        #return self.redis.exists(key)
        return self.redis.hget(key, 'id') != None

    def create_recording(self, user, coll, rec, rec_title, coll_title='',
                         no_dupe=False):

        self.assert_can_write(user, coll)

        orig_rec = rec
        orig_rec_title = rec_title
        count = 1

        rec_list_key = self.rec_list_key.format(user=user, coll=coll)

        while True:
            key = self.rec_info_key.format(user=user, coll=coll, rec=rec)

            if self.redis.hsetnx(key, 'id', rec) == 1:
                break

            # don't create a dupelicate, just use the specified recording
            if no_dupe:
                return self.get_recording(user, coll, rec)

            count += 1
            rec_title = orig_rec_title + ' ' + str(count)
            rec = orig_rec + '-' + str(count)

        now = int(time.time())

        with redis_pipeline(self.redis) as pi:
            pi.hset(key, 'title', rec_title)
            pi.hset(key, 'created_at', now)
            pi.hset(key, 'updated_at', now)
            pi.hsetnx(key, 'size', '0')
            pi.sadd(rec_list_key, rec)

        if not self._has_collection_no_access_check(user, coll):
            coll_title = coll_title or coll
            self.create_collection(user, coll, coll_title)

        return self.get_recording(user, coll, rec)

    def set_recording_timestamps(self, user, coll, rec,
                                 created_at, updated_at):

        self.assert_can_write(user, coll)

        key = self.rec_info_key.format(user=user, coll=coll, rec=rec)

        with redis_pipeline(self.redis) as pi:
            if not pi.exists(key):
                return False

            if created_at:
                pi.hset(key, 'created_at', created_at)

            if updated_at:
                pi.hset(key, 'updated_at', updated_at)

        return True

    def _get_rec_keys(self, user, coll, key_templ):
        self.assert_can_read(user, coll)

        key_pattern = key_templ.format(user=user, coll=coll, rec='*')

        rec_list_key = self.rec_list_key.format(user=user, coll=coll)
        recs = self.redis.smembers(rec_list_key)

        return [key_pattern.replace('*', rec) for rec in recs]


    def get_recordings(self, user, coll):
        keys = self._get_rec_keys(user, coll, self.rec_info_key)

        pi = self.redis.pipeline(transaction=False)
        for key in keys:
            pi.hgetall(key)

        all_recs = pi.execute()

        all_rec_list = []
        for rec in all_recs:
            recording = self._fill_recording(user, coll, rec)
            if recording:
                all_rec_list.append(recording)

        return all_rec_list

    def delete_recording(self, user, coll, rec):
        self.assert_can_admin(user, coll)

        return self._send_delete('rec', user, coll, rec)

    def _get_pagedata(self, user, coll, rec, pagedata):
        key = self.page_key.format(user=user, coll=coll, rec=rec)

        url = pagedata['url']

        ts = pagedata.get('timestamp')
        if not ts:
            ts = pagedata.get('ts')

        if not ts:
            ts = self._get_url_ts(user, coll, rec, url)

        if not ts:
            ts = timestamp_now()

        pagedata['timestamp'] = ts
        pagedata_json = json.dumps(pagedata)

        hkey = pagedata['url'] + ' ' + pagedata['timestamp']

        return key, hkey, pagedata_json

    def add_page(self, user, coll, rec, pagedata):
        self.assert_can_write(user, coll)

        key, hkey, pagedata_json = self._get_pagedata(user, coll, rec, pagedata)

        self.redis.hset(key, hkey, pagedata_json)

        return {}

    def import_pages(self, user, coll, rec, pagelist):
        #self.assert_can_admin(user, coll)

        pagemap = {}

        for pagedata in pagelist:
            key, hkey, pagedata_json = self._get_pagedata(user, coll, rec, pagedata)

            pagemap[hkey] = pagedata_json

        self.redis.hmset(key, pagemap)

        return {}

    def modify_page(self, user, coll, rec, new_pagedata):
        self.assert_can_admin(user, coll)

        key = self.page_key.format(user=user, coll=coll, rec=rec)

        page_key = new_pagedata['url'] + ' ' + new_pagedata['timestamp']

        pagedata = self.redis.hget(key, page_key)
        pagedata = json.loads(pagedata)
        pagedata.update(new_pagedata)

        pagedata_json = json.dumps(pagedata)

        self.redis.hset(key,
                        pagedata['url'] + ' ' + pagedata['timestamp'],
                        pagedata_json)

        return {}

    def delete_page(self, user, coll, rec, url, ts):
        self.assert_can_admin(user, coll)

        key = self.page_key.format(user=user, coll=coll, rec=rec)

        res = self.redis.hdel(key, url + ' ' + ts)
        if res == 1:
            return {}
        else:
            return {'error': 'not found'}

    def list_pages(self, user, coll, rec):
        self.assert_can_read(user, coll)

        key = self.page_key.format(user=user, coll=coll, rec=rec)

        pagelist = self.redis.hvals(key)

        pagelist = [json.loads(x) for x in pagelist]

        if not self.can_admin_coll(user, coll):
            pagelist = [page for page in pagelist if page.get('hidden') != '1']

        return pagelist

    def count_pages(self, user, coll, rec):
        self.assert_can_read(user, coll)

        if rec == '*':
            count = 0

            keys = self._get_rec_keys(user, coll, self.page_key)

            for pagekey in keys:
                count += self.redis.hlen(pagekey)
        else:
            key = self.page_key.format(user=user, coll=coll, rec=rec)
            count = self.redis.hlen(key)

        return count

    def get_size(self, user, coll, rec):
        if not self.can_read_coll(user, coll):
            return None

        if rec and rec != '*':
            key = self.rec_info_key.format(user=user, coll=coll, rec=rec)
        else:
            key = self.coll_info_key.format(user=user, coll=coll)

        res = self.redis.hmget(key, ['size', 'pending_size'])
        total = int(res[0] or 0) + int(res[1] or 0)
        return total

    def get_available_tags(self):
        tags = [t for t, s in list(self.redis.zscan_iter(self.tags_key))]
        # descending order
        tags.reverse()
        return tags

    def list_coll_pages(self, user, coll):
        all_page_keys = self._get_rec_keys(user, coll, self.page_key)

        pagelist = []

        pi = self.redis.pipeline(transaction=False)
        for key in all_page_keys:
            pi.hvals(key)

        all_pages = pi.execute()

        for key, rec_pagelist in zip(all_page_keys, all_pages):
            rec = key.rsplit(':', 2)[-2]
            for page in rec_pagelist:
                page = json.loads(page)
                page['user'] = user
                page['collection'] = coll
                page['recording'] = rec
                pagelist.append(page)

        if not self.can_admin_coll(user, coll):
            pagelist = [page for page in pagelist if page.get('hidden') != '1']

        return sorted(pagelist, key=lambda x: x['timestamp'])

    def num_pages(self, user, coll, rec):
        self.assert_can_read(user, coll)
        key = self.page_key.format(user=user, coll=coll, rec=rec)
        #return self.redis.zcard(key)
        return self.redis.hlen(key)

    def _get_url_ts(self, user, coll, rec, url):
        try:
            key, end_key = calc_search_range(url, 'exact')
        except:
            return None

        cdx_key = self.cdx_key.format(user=user, coll=coll, rec=rec)

        result = self.redis.zrangebylex(cdx_key,
                                        '[' + key,
                                        '(' + end_key)
        if not result:
            return None

        last_cdx = CDXObject(result[-1].encode('utf-8'))

        return last_cdx['timestamp']


# ============================================================================
class CollManagerMixin(object):
    def __init__(self, config):
        super(CollManagerMixin, self).__init__(config)
        self.coll_info_key = config['info_key_templ']['coll']
        self.mount_key = config['mount_key_templ']
        self.upload_key = config['upload_key_templ']
        self.upload_exp = int(config['upload_status_expire'])

    def get_collection(self, user, coll, access_check=True):
        if access_check:
            self.assert_can_read(user, coll)

        key = self.coll_info_key.format(user=user, coll=coll)
        return self._fill_collection(user, self.redis.hgetall(key), True)

    def get_collection_size(self, user, coll):
        key = self.coll_info_key.format(user=user, coll=coll)

        try:
            size = int(self.redis.hget(key, 'size'))
        except:
            size = 0

        return size

    def _fill_collection(self, user, data, include_recs=False):
        result = self._format_info(data)
        if not result:
            return result

        coll = result.get('id')
        if not coll:
            return None
            #if include_recs:
            #    result['title'] = ''
            #    result['recordings'] = []
            #return result

        path = self.download_paths['coll']
        path = path.format(host=self.get_host(),
                           user=user,
                           coll=coll)

        result['download_url'] = path

        if include_recs:
            result['recordings'] = self.get_recordings(user, coll)

        return result

    def add_mount(self, user, coll, rec, rec_title,
                  mount_type, mount_desc, mount_config):
        rec_info = self.create_recording(user, coll, rec, rec_title)
        rec = rec_info['id']

        mount_key = self.mount_key.format(user=user, coll=coll, rec=rec)

        rec_key = self.rec_info_key.format(user=user, coll=coll, rec=rec)

        with redis_pipeline(self.redis) as pi:
            pi.set(mount_key, mount_config)

            pi.hset(rec_key, 'mount_type', mount_type)
            if mount_desc:
                pi.hset(rec_key, 'mount_desc', mount_desc)

        return rec_info

    def _has_collection_no_access_check(self, user, coll):
        key = self.coll_info_key.format(user=user, coll=coll)
        return self.redis.hget(key, 'id') != None

    def has_collection(self, user, coll):
        if not self.can_read_coll(user, coll):
            return False

        return self._has_collection_no_access_check(user, coll)

    def create_collection(self, user, coll, coll_title, desc='', public=False):
        self.assert_can_admin(user, coll)

        orig_coll = coll
        orig_coll_title = coll_title
        count = 1

        while True:
            key = self.coll_info_key.format(user=user, coll=coll)

            if self.redis.hsetnx(key, 'id', coll) == 1:
                break

            count += 1
            coll_title = orig_coll_title + ' ' + str(count)
            coll = orig_coll + '-' + str(count)

        now = int(time.time())

        with redis_pipeline(self.redis) as pi:
            pi.hset(key, 'title', coll_title)
            pi.hset(key, 'created_at', now)
            pi.hset(key, 'desc', desc)
            if public:
                pi.hset(key, self.READ_PREFIX + self.PUBLIC, 1)
            pi.hsetnx(key, 'size', '0')

        return self.get_collection(user, coll)

    def num_collections(self, user):
        key_pattern = self.coll_info_key.format(user=user, coll='*')

        keys = list(self.redis.scan_iter(match=key_pattern))

        if not self.is_owner(user):
            keys = [key for key in keys if self.is_public(user, key)]

        return len(keys)

    def get_collections(self, user, include_recs=False, api=False):
        key_pattern = self.coll_info_key.format(user=user, coll='*')

        keys = list(self.redis.scan_iter(match=key_pattern))

        pi = self.redis.pipeline(transaction=False)
        for key in keys:
            pi.hgetall(key)

        all_colls = pi.execute()

        all_coll_list = []
        for coll in all_colls:
            collection = self._fill_collection(user, coll,
                                               include_recs=include_recs)
            if collection:
                all_coll_list.append(collection)

        all_colls = all_coll_list

        # if this is an API request or the user is not an owner,
        # filter out private collections
        if api or not self.is_owner(user):
            all_colls = [coll for coll in all_colls
                         if coll.get(self.READ_PREFIX + self.PUBLIC)]

        return all_colls

    def delete_collection(self, user, coll):
        if self.is_anon(user):
            return self.delete_user(user)

        self.assert_can_admin(user, coll)

        return self._send_delete('coll', user, coll)

    def set_coll_prop(self, user, coll, prop_name, prop_value):
        self.assert_can_admin(user, coll)

        key = self.coll_info_key.format(user=user, coll=coll)

        self.redis.hset(key, prop_name, prop_value)

    def set_rec_prop(self, user, coll, rec, prop_name, prop_value):
        self.assert_can_admin(user, coll)

        key = self.rec_info_key.format(user=user, coll=coll, rec=rec)

        self.redis.hset(key, prop_name, prop_value)

    def get_tags_in_collection(self, user, coll):
        keys = self.redis.keys('*:{user}:{coll}:*:tag:*'.format(user=user,
                                                                coll=coll))

        # return pages grouped by tag
        tagged_pages = {}
        for k in keys:
            tag = k.split(':')[5]
            if tag in tagged_pages:
                tagged_pages[tag] |= self.redis.smembers(k)
            else:
                tagged_pages.update({
                    tag: self.redis.smembers(k)
                })

        return tagged_pages

    def get_upload_status(self, user, upload_id):
        upload_key = self.upload_key.format(user=user, upid=upload_id)

        props = self.redis.hgetall(upload_key)

        props['user'] = user
        props['upload_id'] = upload_id

        total_size = props.get('total_size')
        if not total_size:
            return props

        self.redis.expire(upload_key, self.upload_exp)
        props['total_size'] = int(total_size)
        props['size'] = int(props.get('size', 0))
        props['files'] = int(props['files'])
        props['total_files'] = int(props['total_files'])

        if props.get('files') == 0:
            props['size'] = props['total_size']

        return props


# ============================================================================
class DeleteManagerMixin(object):
    def __init__(self, config):
        super(DeleteManagerMixin, self).__init__(config)
        self.delete_url_templ = config['url_templates']['delete']

    def _send_delete(self, type_, user, coll='*', rec='*'):
        delete_url = self.delete_url_templ.format(record_host=os.environ['RECORD_HOST'],
                                                  user=user,
                                                  coll=coll,
                                                  rec=rec,
                                                  type=type_)

        res = requests.delete(delete_url)

        return res.json() == {}


# ============================================================================
class Base(object):
    def __init__(self, config):
        self.download_paths = config['download_paths']
        self.INT_KEYS = ('size', 'created_at', 'updated_at')

    def get_content_inject_info(self, user, coll, rec):
        info = {}

        coll_key = self.coll_info_key.format(user=user, coll=coll)

        # recording
        if rec != '*' and rec:
            rec_key = self.rec_info_key.format(user=user, coll=coll, rec=rec)
            rec = quote(rec)
            info['rec_title'], info['size'] = self.redis.hmget(rec_key, ['title', 'size'])
            if info.get('rec_title'):
                info['rec_title'] = quote(info['rec_title'], safe='/ ')
            else:
                info['rec_title'] = rec
            info['rec_id'] = rec
        else:
            info['size'] = self.redis.hget(coll_key, 'size')

        # collection
        coll = quote(coll)
        info['coll_id'] = coll
        info['coll_title'] = self.redis.hget(coll_key, 'title')

        if info.get('coll_title'):
            info['coll_title'] = quote(info['coll_title'], safe='/ ')
        else:
            info['coll_title'] = coll

        info['coll_desc'] = self.redis.hget(coll_key, 'desc')

        try:
            info['size'] = int(info['size'])
        except Exception as e:
            info['size'] = 0

        info['size_remaining'] = self.get_size_remaining(user)

        #if self.is_anon(user):
        #    info['user'] = '@anon'
        #else:
        info['user'] = user

        return info

    def _format_info(self, result):
        if not result:
            return {}

        result = self._to_int(result)
        return result

    def _to_int(self, result):
        for x in self.INT_KEYS:
            if x in result:
                result[x] = int(result[x])
        return result

    def get_host(self):
        return request.urlparts.scheme + '://' + request.urlparts.netloc


# ============================================================================
class RedisDataManager(AccessManagerMixin, CollManagerMixin, DeleteManagerMixin,
                       LoginManagerMixin, PageManagerMixin, RecManagerMixin,
                       Base):
    def __init__(self, redis, cork, content_app, browser_redis, browser_mgr, config):
        self.redis = redis
        self.cork = cork
        self.config = config

        self.content_app = content_app

        if self.content_app:
            self.content_app.manager = self

        self.browser_redis = browser_redis
        self.browser_mgr = browser_mgr

        super(RedisDataManager, self).__init__(config)


# ============================================================================
class CLIRedisDataManager(RedisDataManager):
    def can_read_coll(self, user, coll):
        return True

    def can_write_coll(self, user, coll):
        return True

    def can_admin_coll(self, user, coll):
        return True

    def can_mount_coll(self, user, coll):
        return True

    def can_tag(self):
        return True

    def is_owner(self, user):
        return True

    def assert_logged_in(self):
        return True

    def get_session(self):
        return self.fake_session

    def get_host(self):
        return 'http://localhost'


# ============================================================================
def init_manager_for_cli():
    config = load_wr_config()

    # Init Redis
    redis_url = os.environ['REDIS_BASE_URL']

    r = redis.StrictRedis.from_url(redis_url, decode_responses=True)

    # Init Cork
    cork = WebRecCork.create_cork(r, config)

    # Init Manager
    manager = CLIRedisDataManager(r, cork, None, None, None, config)
    manager.fake_session = Session(cork, {}, '', {'anon': True}, -1, False)

    return manager
