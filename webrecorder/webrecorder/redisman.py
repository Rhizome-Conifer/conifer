import six
import time
import redis
import re
import json
import os
import base64
import hashlib
import gevent
import logging

from datetime import datetime

from bottle import template, request, HTTPError

from webrecorder.webreccork import ValidationException
from webrecorder.redisutils import RedisTable
from webrecorder.webreccork import WebRecCork
from webrecorder.session import Session

from cork import AAAException

from six.moves.urllib.parse import quote, urlsplit
from six.moves import range

from pywb.utils.canonicalize import calc_search_range
from pywb.warcserver.index.cdxobject import CDXObject

from pywb.utils.loaders import load

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
        self.default_list_endpoint = os.environ.get('MAILING_LIST_ENDPOINT', '')
        self.list_key = os.environ.get('MAILING_LIST_KEY', '')
        self.list_removal_endpoint = os.path.expandvars(
                                        os.environ.get('MAILING_LIST_REMOVAL', ''))
        self.payload = os.environ.get('MAILING_LIST_PAYLOAD', '')
        self.remove_on_delete = (os.environ.get('REMOVE_ON_DELETE', '')
                                 in ('true', '1', 'yes'))

        self.rate_limit_key = config['rate_limit_key']
        self.rate_limit_max = int(os.environ.get('RATE_LIMIT_MAX', 0))
        self.rate_limit_hours = int(os.environ.get('RATE_LIMIT_HOURS', 0))
        self.rate_limit_restricted_max = int(os.environ.get('RATE_LIMIT_RESTRICTED_MAX', self.rate_limit_max))
        self.rate_limit_restricted_hours = int(os.environ.get('RATE_LIMIT_RESTRICTED_HOURS', self.rate_limit_hours))

        self.rate_restricted_ips = os.environ.get('RATE_LIMIT_RESTRICTED_IPS', '').split(',')

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
        coll_map_key = self.coll_map_key.format(user=user)
        colls = self.redis.hvals(coll_map_key)

        for coll in colls:
            self.delete_collection(user, coll)

        if not self.is_anon(user):
            if not self.is_superuser():
                self.assert_user_is_owner(user)

            # Check for mailing list & removal endpoint
            if self.mailing_list and self.remove_on_delete:
                self.remove_from_mailing_list(self.get_user_email(user))

            self.cork.user(user).delete()

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

    def is_rate_limited(self, user, ip):
        if not self.rate_limit_hours or not self.rate_limit_max:
            return False

        if self.is_superuser():
            return False

        rate_key = self.rate_limit_key.format(ip=ip, H='')
        h = int(datetime.utcnow().strftime('%H'))

        if ip in self.rate_restricted_ips:
            limit_hours = self.rate_limit_restricted_hours
            limit_max = self.rate_limit_restricted_max
        else:
            limit_hours = self.rate_limit_hours
            limit_max = self.rate_limit_max

        rate_keys = [rate_key + '%02d' % ((h - i) % 24)
                     for i in range(0, limit_hours)]

        values = self.redis.mget(rate_keys)
        total = sum(int(v) for v in values if v)

        return (total >= limit_max)

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

    def rename_recording(self, user,
                         from_coll, from_rec_name,
                         to_coll, to_rec_name, to_rec_title=None, rec=None):
        if not rec:
            rec = self.recs_map.name_to_id(from_coll, from_rec_name)

        if not from_coll or not rec:
            return None

        to_rec_title = to_rec_title or to_rec_name

        res = self.recs_map.rename(rec, from_coll, to_coll,
                                   from_rec_name, to_rec_name, to_rec_title)

        if from_coll != to_coll:
            try:
                size = int(self.redis.hget(self.rec_info_key.format(rec=rec), 'size'))
                self.redis.hincrby(self.coll_info_key.format(coll=from_coll), 'size', -size)
                self.redis.hincrby(self.coll_info_key.format(coll=to_coll), 'size', size)
            except Exception as e:
                print('Failed Size Update: ' + str(e))

        return res

    def rename_old(self, user, coll, new_coll, rec='*', new_rec='*',
               new_user='', title='', is_move=False):

        if not new_user:
            new_user = user

        self.assert_can_admin(new_user, new_coll)

        if is_move:
            if not self.has_collection(new_user, new_coll):
                return {'error_message': 'No Such Collection'}

        elif user != new_user or coll != new_coll:
            id_, new_coll_info = self.create_collection(new_user, new_coll, title)
            title = new_coll_info['title']
            new_coll = new_coll_info['id']

        if rec != '*' and new_rec != '*':
            new_rec_info = self.create_recording(new_user, new_coll, new_rec, title)
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
            if coll != new_coll and rec != '*':
                self.sync_coll_index(user, coll, exists=True, do_async=True)
                self.sync_coll_index(new_user, new_coll, exists=True, do_async=True)

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

    def _check_write_access(self, user, coll):
        # anon access
        if self.is_anon(user):
            if self.is_coll_owner(user, coll):
                return True

        sesh = self.get_session()

        # current user
        if user == sesh.curr_user:
            return True

        if sesh.curr_user:
            key = self.coll_info_key.format(user=user, coll=coll)
            return self.redis.hget(key, self.WRITE_PREFIX + sesh.curr_user) != None

        return False

    def _check_read_access_public(self, user, coll):
        if self.is_public(user, coll):
            return 'public'

        # anon access
        if self.is_anon(user):
            if self.is_coll_owner(user, coll):
                return True

        sesh = self.get_session()

        # current user or superusers always have access, if collection exists
        if user == sesh.curr_user or sesh.curr_role == 'admin':
            return True

        if sesh.curr_user:
            key = self.coll_info_key.format(user=user, coll=coll)
            return self.redis.hget(key, self.READ_PREFIX + sesh.curr_user) != None

        return False

    def is_coll_owner(self, user, coll):
        key = self.coll_info_key.format(user=user, coll=coll)
        res = self.redis.hget(key, 'owner')
        return res == user

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
        return bool(self._check_read_access_public(user, coll))

    def can_write_coll(self, user, coll):
        return self._check_write_access(user, coll)

    def is_extractable(self, user, coll):
        if not self.can_read_coll(user, coll):
            return False

        # for now, no extractable view
        return False

    # for now, equivalent to is_owner(), but a different
    # permission, and may change
    def can_admin_coll(self, user, coll=None):
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

        self.rec_map_key = config['rec_map_key_templ']
        self.recs_map = RedisIdMapper(self.redis, 'recs', self.rec_map_key, 'coll')

        self.open_rec_key = config['open_rec_key_templ']
        self.open_rec_ttl = int(config['open_rec_ttl'])

        self.warc_key_templ = config['warc_key_templ']
        self.del_templ = config['del_templ']
        self.del_q = 'q:del:{target}'

        self.page_key = config['page_key_templ']
        self.cdxj_key = config['cdxj_key_templ']
        self.tags_key = config['tags_key']

        self.ra_key = config['ra_key']

        self.dyn_stats_key_templ = config['dyn_stats_key_templ']
        self.dyn_ref_templ = config['dyn_ref_templ']

        self.dyn_stats_secs = config['dyn_stats_secs']

    def get_coll_rec_ids(self, user, coll_name, rec_name):
        rec = ''
        coll = self.colls_map.name_to_id(user, coll_name) or ''
        if coll and rec_name != '*':
            rec = self.recs_map.name_to_id(coll, rec_name)

        return coll, rec

    def get_recording(self, user, coll, rec):
        self.assert_can_read(user, coll)

        key = self.rec_info_key.format(user=user, coll=coll, rec=rec)

        return self._fill_recording(user, coll, rec, self.redis.hgetall(key))

    def get_recording_title(self, user, coll, rec):
        self.assert_can_read(user, coll)
        key = self.rec_info_key.format(user=user, coll=coll, rec=rec)
        return self.redis.hget(key, 'title')

    def _fill_recording(self, user, coll, rec, data):
        result = self._format_info(data)

        if not result:
            return result

        #TODO; check
        # an edge case where rec data is partially filled
        # considered not a valid recording, so skip
        if not result.get('title'):
            return None

        path = self.download_paths['rec']
        path = path.format(host=self.get_host(),
                           user=user,
                           coll=coll,
                           rec=rec)

        result['download_url'] = path

        # add any remote archive sources
        sources_key = self.ra_key.format(user=user, coll=coll, rec=rec)
        result['ra_sources'] = list(self.redis.smembers(sources_key))

        #if result.get('pending_size') and result.get('size'):
        #    result['size'] = int(result['size']) + int(result['pending_size'])
        return result

    def has_recording(self, user, coll, rec):
        #self.assert_can_read(user, coll)
        if not self.can_read_coll(user, coll):
            return False

        key = self.rec_info_key.format(user=user, coll=coll, rec=rec)

        # ensure id is valid
        return self.redis.hget(key, 'title') != None

    def is_recording_open(self, user, coll, rec):
        key = self.open_rec_key.format(user=user, coll=coll, rec=rec)
        return self.redis.expire(key, self.open_rec_ttl)

    def create_recording(self, user, coll, rec_name, rec_title,
                         no_dupe=False, rec_type=None, ra_list=None):

        self.assert_can_write(user, coll)

        rec, rec_name, rec_title = self.recs_map.create_new(coll, rec_name, rec_title)

        now = int(time.time())

        if ra_list:
            ra_key = self.ra_key.format(user=user,
                                        coll=coll,
                                        rec=rec)

        open_key = self.open_rec_key.format(user=user, coll=coll, rec=rec)
        key = self.rec_info_key.format(rec=rec)

        with redis_pipeline(self.redis) as pi:
            pi.hset(key, 'title', rec_title)
            pi.hset(key, 'created_at', now)
            pi.hset(key, 'updated_at', now)
            pi.hsetnx(key, 'size', '0')
            if rec_type:
                pi.hset(key, 'rec_type', rec_type)
            if ra_list:
                pi.sadd(ra_key, *ra_list)

            pi.setex(open_key, self.open_rec_ttl, 1)

        if not self._has_collection_no_access_check(user, coll):
            coll_title = coll_title or coll
            self.create_collection(user, coll, coll_title)

        return rec, rec_name, self.get_recording(user, coll, rec)

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

        rec_map_key = self.rec_map_key.format(coll=coll)
        recs = self.redis.hvals(rec_map_key)

        return [key_pattern.replace('*', rec) for rec in recs]

    def get_recordings(self, user, coll):
        self.assert_can_read(user, coll)

        rec_map_key = self.rec_map_key.format(coll=coll)
        rec_map = self.redis.hgetall(rec_map_key)

        rec_infos = self.rec_info_key.format(rec='*')

        pi = self.redis.pipeline(transaction=False)

        for name, rec in rec_map.items():
            rec = rec_infos.replace('*', rec)
            pi.hgetall(rec)

        all_recs = pi.execute()

        all_rec_list = []
        for (name, rec), data in zip(rec_map.items(), all_recs):
            recording = self._fill_recording(user, coll, rec, data)
            if recording:
                recording['id'] = name
                recording['uid'] = rec
                all_rec_list.append(recording)

        return all_rec_list

    def delete_recording(self, user, coll, rec, many=False):
        if not many:
            self.assert_can_admin(user, coll)

        # queue warcs for deletion
        warc_key = self.warc_key_templ.format(rec=rec)

        for n, v in self.redis.hgetall(warc_key).items():
            parts = urlsplit(v)
            if parts.scheme == 'http':
                del_q = self.del_q.format(target=parts.netloc)
            elif parts.scheme:
                del_q = self.del_q.format(target=parts.scheme)
            else:
                del_q = self.del_q.format(target='nginx')

            self.redis.rpush(del_q, v)

        del_rec_keys = self.del_templ['rec'].format(rec=rec)

        try:
            size = int(self.redis.hget(self.rec_info_key.format(rec=rec), 'size'))
        except Exception as e:
            size = 0
            print('Failed Size Get: ' + str(e))

        if size:
            self.redis.hincrby(self.coll_info_key.format(coll=coll), 'size', -size)
            self.redis.hincrby(self.user_key.format(user=user), 'size', -size)

        deleted = False

        for key in self.redis.scan_iter(del_rec_keys, count=100):
            self.redis.delete(key)
            deleted = True

        if not many:
            self.sync_coll_index(user, coll, exists=True, do_async=True)

        return deleted

    def delete_recording_old(self, user, coll, rec):
        self.assert_can_admin(user, coll)

        res = self._send_delete('rec', user, coll, rec)

        self.sync_coll_index(user, coll, exists=True, do_async=True)

        return res

    def track_remote_archive(self, pi, user, coll, rec, source_id):

        ra_key = self.ra_key.format(user=user,
                                    coll=coll,
                                    rec=rec)

        pi.sadd(ra_key, source_id)

    def _res_url_templ(self, base_templ, params, url):
        rec = params['rec']
        if not rec or rec == '*':
            base_url = base_templ['coll']
        else:
            base_url = base_templ['rec']

        return base_url.format(coll=params['coll'],
                               rec=rec,
                               id=params['id']) + url

    def update_dyn_stats(self, url, params, referrer, source, ra_rec):
        if referrer.endswith('.css'):
            css_res = self._res_url_templ(self.dyn_ref_templ, params, referrer)
            orig_referrer = self.redis.get(css_res)
            if orig_referrer:
                referrer = orig_referrer

        dyn_stats_key = self._res_url_templ(self.dyn_stats_key_templ,
                                             params, referrer)

        curr_url_key = self._res_url_templ(self.dyn_stats_key_templ,
                                           params, url)

        with redis_pipeline(self.redis) as pi:
            pi.delete(curr_url_key)

            pi.hincrby(dyn_stats_key, source, 1)
            pi.expire(dyn_stats_key, self.dyn_stats_secs)

            if url.endswith('.css'):
                css_res = self._res_url_templ(self.dyn_ref_templ, params, url)
                pi.setex(css_res, self.dyn_stats_secs, referrer)

            if ra_rec:
                self.track_remote_archive(pi, params['user'], params['coll'],
                                          ra_rec, source)

    def get_dyn_stats(self, user, coll, rec, sesh_id, url):
        params = {'user': user,
                  'coll': coll,
                  'rec': rec,
                  'id': sesh_id}

        dyn_stats_key = self._res_url_templ(self.dyn_stats_key_templ,
                                             params, url)

        stats = self.redis.hgetall(dyn_stats_key)
        if stats:
            self.redis.expire(dyn_stats_key, self.dyn_stats_secs)

        return stats

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

    def add_page(self, user, coll, rec, pagedata, check_dupes=False):
        self.assert_can_write(user, coll)

        if not self.is_recording_open(user, coll, rec):
            return {'error_msg': 'recording not open'}

        # if check dupes, check for existing page and avoid adding duplicate
        if check_dupes:
            if self.has_page(user, coll, pagedata['url'], pagedata['timestamp']):
                return {}

        key, hkey, pagedata_json = self._get_pagedata(user, coll, rec, pagedata)

        self.redis.hset(key, hkey, pagedata_json)

        return {}

    def has_page(self, user, coll, url, ts):
        self.assert_can_read(user, coll)

        all_page_keys = self._get_rec_keys(user, coll, self.page_key)

        hkey = url + ' ' + ts

        for key in all_page_keys:
            if self.redis.hget(key, hkey):
                return True

        return False

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

        # add page ids
        for page in pagelist:
            bk_attrs = (page['url'] + page['timestamp']).encode('utf-8')
            page['id'] = hashlib.md5(bk_attrs).hexdigest()[:10]

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

        cdxj_key = self.cdxj_key.format(user=user, coll=coll, rec=rec)

        result = self.redis.zrangebylex(cdxj_key,
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

        self.coll_map_key = config['coll_map_key_templ']
        self.colls_map = RedisIdMapper(self.redis, 'colls', self.coll_map_key, 'user')

        self.coll_cdxj_key = config['coll_cdxj_key_templ']
        self.coll_cdxj_ttl = int(config['coll_cdxj_ttl'])
        self.info_index_key = config['info_index_key']

        self.record_root_dir = os.environ['RECORD_ROOT']

        self.upload_key = config['upload_key_templ']
        self.upload_exp = int(config['upload_status_expire'])

    def get_collection(self, user, coll, access_check=True):
        if access_check:
            self.assert_can_read(user, coll)

        key = self.coll_info_key.format(user=user, coll=coll)
        return self._fill_collection(user, coll, self.redis.hgetall(key), True)

    def get_collection_size(self, user, coll):
        key = self.coll_info_key.format(user=user, coll=coll)

        try:
            size = int(self.redis.hget(key, 'size'))
        except:
            size = 0

        return size

    def _fill_collection(self, user, coll, data, include_recs=False):
        result = self._format_info(data)
        if not result:
            return result

        # TODO: check
        if not result.get('title'):
            return None

        path = self.download_paths['coll']
        path = path.format(host=self.get_host(),
                           user=user,
                           coll=coll)

        result['download_url'] = path

        if include_recs:
            result['recordings'] = self.get_recordings(user, coll)

        return result

    def _has_collection_no_access_check(self, user, coll):
        key = self.coll_info_key.format(user=user, coll=coll)
        return self.redis.hget(key, 'title') != None

    def has_collection_is_public(self, user, coll):
        res = self._check_read_access_public(user, coll)
        if not res:
            return False

        if not self._has_collection_no_access_check(user, coll):
            return False

        return res

    def collection_by_name(self, user, coll_name):
        coll = self.colls_map.name_to_id(user, coll_name)
        if not coll:
            return None

        if self.has_collection(user, coll):
            return coll

    def has_collection(self, user, coll):
        if not self.can_read_coll(user, coll):
            return False

        return self._has_collection_no_access_check(user, coll)

    def create_collection(self, user, coll_name, coll_title, desc='', public=False):
        self.assert_can_admin(user, None)

        coll, coll_name, coll_title = self.colls_map.create_new(user, coll_name, coll_title)

        key = self.coll_info_key.format(coll=coll)

        now = int(time.time())

        with redis_pipeline(self.redis) as pi:
            #pi.hset(key, 'id',  coll_name)
            pi.hset(key, 'owner', user)
            pi.hset(key, 'title', coll_title)
            pi.hset(key, 'created_at', now)
            pi.hset(key, 'desc', desc)
            if public:
                pi.hset(key, self.READ_PREFIX + self.PUBLIC, 1)
            pi.hsetnx(key, 'size', '0')

        return coll, coll_name, self.get_collection(user, coll)

    def _get_coll_keys(self, user):
        key_pattern = self.coll_info_key.format(user=user, coll='*')

        coll_map_key = self.coll_map_key.format(user=user)
        colls = self.redis.hvals(coll_map_key)

        return [key_pattern.replace('*', coll) for coll in colls]

    def num_collections(self, user):
        # if owner, just check num collections
        if self.is_owner(user):
            coll_map_key = self.coll_map_key.format(user=user)
            num_colls = self.redis.hlen(coll_map_key)
            return num_colls

        keys = self._get_coll_keys(user)
        count = 0

        for key in keys:
            if self.is_public(user, key):
                count += 1

        return count

    def get_collections(self, user, include_recs=False, api=False):
        keys = self._get_coll_keys(user)

        pi = self.redis.pipeline(transaction=False)
        for coll in keys:
            pi.hgetall(coll)

        all_colls = pi.execute()

        all_coll_list = []
        for coll, data in zip(keys, all_colls):
            collection = self._fill_collection(user, coll, data,
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

    def delete_collection(self, user, coll, rec, many=False):
        if not many:
            self.assert_can_admin(user, coll)

        recs = self._get_rec_keys(user, coll, '*')

        for rec in recs:
            self.delete_recording(user, coll, rec, many=True)

        try:
            size = int(self.redis.hget(self.coll_info_key.format(coll=coll), 'size'))
        except Exception as e:
            size = 0
            print('Failed Size Get: ' + str(e))

        if size:
            self.redis.hincrby(self.user_key.format(user=user), 'size', -size)

        deleted = False

        del_coll_keys = self.del_templ['coll'].format(coll=coll)

        for key in self.redis.scan_iter(del_coll_keys, count=100):
            self.redis.delete(key)
            deleted = True

        return deleted

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
        if not props:
            return {}

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

    def sync_coll_index(self, user, coll, exists=False, do_async=False):
        coll_cdxj_key = self.coll_cdxj_key.format(user=user, coll=coll)
        if exists != self.redis.exists(coll_cdxj_key):
            self.redis.expire(coll_cdxj_key, self.coll_cdxj_ttl)
            return

        cdxj_keys = self._get_rec_keys(user, coll, self.cdxj_key)
        if not cdxj_keys:
            return

        self.redis.zunionstore(coll_cdxj_key, cdxj_keys)
        self.redis.expire(coll_cdxj_key, self.coll_cdxj_ttl)

        ges = []
        for cdxj_key in cdxj_keys:
            if self.redis.exists(cdxj_key):
                continue

            ges.append(gevent.spawn(self._do_download_cdxj, cdxj_key, coll_cdxj_key))

        if not do_async:
            res = gevent.joinall(ges)

    def _do_download_cdxj(self, cdxj_key, output_key):
        lock_key = None
        try:
            rec_warc_key = cdxj_key.rsplit(':', 1)[0] + ':warc'
            cdxj_filename = self.redis.hget(rec_warc_key, self.info_index_key)
            if not cdxj_filename:
                logging.debug('No index for ' + rec_warc_key)
                return

            lock_key = cdxj_key + ':_'
            logging.debug('Downloading for {0} file {1}'.format(rec_warc_key, cdxj_filename))
            attempts = 0

            if not self.redis.set(lock_key, 1, nx=True):
                logging.warning('Already downloading, skipping')
                lock_key = None
                return

            while attempts < 10:
                try:
                    fh = load(cdxj_filename)
                    buff = fh.read()

                    for cdxj_line in buff.splitlines():
                        self.redis.zadd(output_key, 0, cdxj_line)

                    break
                except:
                    logging.error('Could not load: ' + cdxj_filename)
                    attempts += 1

                finally:
                    fh.close()

            self.redis.expire(output_key, self.coll_cdxj_ttl)

        except Exception as e:
            logging.error('Error downloading cache: ' + str(e))

        finally:
            if lock_key:
                self.redis.delete(lock_key)


# ============================================================================
class DeleteManagerMixin(object):
    def __init__(self, config):
        super(DeleteManagerMixin, self).__init__(config)
        self.delete_url_templ = config['url_templates']['delete']

    def _send_delete(self, type_, user, coll='*', rec='*'):
        # first, remove open key for any recordings that are being deleted
        # to prevent further writing
        open_key_templ = self.open_rec_key.format(user=user, coll=coll, rec=rec)
        for open_key in self.redis.scan_iter(open_key_templ):
            self.redis.delete(open_key)

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

    def get_content_inject_info(self, user, coll, coll_name, rec, rec_name):
        info = {}

        coll_key = self.coll_info_key.format(user=user, coll=coll)

        # recording
        if rec != '*' and rec:
            rec_key = self.rec_info_key.format(user=user, coll=coll, rec=rec)
            rec_name = quote(rec_name)
            info['rec_title'], info['size'] = self.redis.hmget(rec_key, ['title', 'size'])
            if info.get('rec_title'):
                info['rec_title'] = quote(info['rec_title'], safe='/ ')
            else:
                info['rec_title'] = rec_name
            info['rec_id'] = rec_name
        else:
            info['size'] = self.redis.hget(coll_key, 'size')

        # collection
        coll_name = quote(coll_name)
        info['coll_id'] = coll_name
        info['coll_title'] = self.redis.hget(coll_key, 'title')

        if info.get('coll_title'):
            info['coll_title'] = quote(info['coll_title'], safe='/ ')
        else:
            info['coll_title'] = coll_name

        info['coll_desc'] = quote(self.redis.hget(coll_key, 'desc'))

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

    def can_extract_coll(self, user, coll):
        return False

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
