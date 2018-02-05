
import json
import time
import redis
import re

from operator import itemgetter

from bottle import request, HTTPError
from datetime import datetime, timedelta
from re import sub

from webrecorder.apiutils import CustomJSONEncoder
from webrecorder.basecontroller import BaseController
from webrecorder.schemas import (CollectionSchema, NewUserSchema, TempUserSchema,
                                 UserSchema, UserUpdateSchema)


# ============================================================================
class UserController(BaseController):
    def __init__(self, *args, **kwargs):
        super(UserController, self).__init__(*args, **kwargs)
        config = kwargs['config']

        self.cork = kwargs['cork']

        self.default_user_desc = config['user_desc']
        self.user_usage_key = config['user_usage_key']
        self.temp_usage_key = config['temp_usage_key']
        self.temp_user_key = config['temp_prefix']
        self.tags_key = config['tags_key']

    def init_routes(self):

        @self.app.route(['/api/v1/settings'], ['GET', 'PUT'])
        @self.user_manager.admin_view()
        def internal_settings():
            settings = {}
            config = self.redis.hgetall('h:defaults')
            tags = list(self.redis.zscan_iter(self.tags_key))

            if request.method == 'PUT':
                data = json.loads(request.forms.json)
                config.update(data['settings'])
                # commit to redis
                self.redis.hmset('h:defaults', config)

                incoming_tags = [t for t in data['tags']]
                existing_tags = [t for t, s in tags]
                # add tags
                for tag in incoming_tags:
                    if tag not in existing_tags:
                        self.redis.zadd(self.tags_key, 0, self.sanitize_tag(tag))

                # remove tags
                for tag in existing_tags:
                    if tag not in incoming_tags:
                        self.redis.zrem(self.tags_key, self.sanitize_tag(tag))

                tags = list(self.redis.zscan_iter(self.tags_key))

            # descending order
            tags.reverse()

            settings['defaults'] = config
            settings['tags'] = [{'name': t,
                                 'usage': int(s)} for t, s in tags]
            return settings

        @self.app.get(['/api/v1/dashboard', '/api/v1/dashboard/'])
        @self.user_manager.admin_view()
        def api_dashboard():
            cache_key = self.cache_template.format('dashboard')
            expiry = 5 * 60  # 5 min

            cache = self.redis.get(cache_key)

            if cache:
                return json.loads(cache)

            users = self.manager.get_users().items()
            results = []

            # add username and get collections
            for user, data in users:
                data['username'] = user
                results.append(data)

            temp = self.redis.hgetall(self.temp_usage_key)
            user = self.redis.hgetall(self.user_usage_key)
            temp = [(k, int(v)) for k, v in temp.items()]
            user = [(k, int(v)) for k, v in user.items()]

            all_collections = []
            for res in results:
                all_collections.extend(
                    self.manager.get_collections(user=res['username'], api=True)
                )

            data = {
                'users': UserSchema().load(results, many=True).data,
                'collections': all_collections,
                'temp_usage': sorted(temp, key=itemgetter(0)),
                'user_usage': sorted(user, key=itemgetter(0)),
            }

            self.redis.setex(cache_key,
                                     expiry,
                                     json.dumps(data, cls=CustomJSONEncoder))

            return data

        @self.app.get(['/api/v1/users', '/api/v1/users/'])
        @self.user_manager.admin_view()
        def api_users():
            """Full admin API resource of all users.
               Containing user info and public collections

               - Provides basic (1 dimension) RESTful sorting
               - TODO: Pagination
            """
            sorting = request.query.getunicode('sort', None)
            sort_key = sub(r'^-{1}?', '', sorting) if sorting is not None else None
            reverse = sorting.startswith('-') if sorting is not None else False

            def dt(d):
                return datetime.strptime(d, '%Y-%m-%d %H:%M:%S.%f')

            # sortable fields, with optional key unpacking functions
            filters = {
                'created': {'key': lambda obj: dt(obj[1]['creation_date'])},
                'email': {'key': lambda obj: obj[1]['email_addr']},
                'last_login': {'key': lambda obj: dt(obj[1]['last_login'])},
                'name': {'key': lambda obj: json.loads(obj[1]['desc'] or '{}')['name']},
                'username': {},
            }

            if sorting is not None and sort_key not in filters:
                raise HTTPError(400, 'Bad Request')

            sort_by = filters[sort_key] if sorting is not None else None
            users = sorted(self.manager.get_users().items(),
                           key=sort_by,
                           reverse=reverse)

            results = []

            # add username
            for user, data in users:
                data['username'] = user
                # add space usage
                total = self.manager.get_size_allotment(user)
                used = self.manager.get_size_usage(user)
                data['space_utilization'] = {
                    'total': total,
                    'used': used,
                    'available': total - used,
                }
                results.append(data)

            return {
                # `results` is a list so will always read as `many`
                'users': UserSchema().load(results, many=True).data
            }

        @self.app.get('/api/v1/anon_user')
        def get_anon_user():
            sesh_user = self.access.init_session_user(persist=True)
            return {'anon_user': sesh_user.my_id}

        @self.app.get('/api/v1/curr_user')
        def get_curr_user():
            sesh_user = self.access.session_user
            return {'curr_user': sesh_user.my_id}

        @self.app.get(['/api/v1/user_roles'])
        def api_get_user_roles():
            return {"roles": [x for x in self.cork._store.roles]}

        @self.app.get('/api/v1/temp-users')
        @self.user_manager.admin_view()
        def temp_users():
            """ Resource returning active temp users
            """
            temp_users_keys = self.redis.keys('u:{0}*:info'.format(self.temp_user_key))
            temp_users = []

            if len(temp_users_keys):
                with self.redis.pipeline() as pi:
                    for user in temp_users_keys:
                        pi.hgetall(user)
                    temp_users = pi.execute()

                for idx, user in enumerate(temp_users_keys):
                    temp_users[idx]['username'] = user

                # skip over incomplete
                temp_users = [{k: v for k, v in d.items()}
                              for d in temp_users
                              if 'max_size' in d and 'created_at' in d]

                for user in temp_users:
                    total = int(user['max_size'])
                    used = int(user.get('size', 0))
                    creation = datetime.fromtimestamp(int(user['created_at']))
                    removal = creation + timedelta(seconds=self.config['session.durations']['short']['total'])

                    u = re.search(r'{0}\w+'.format(self.temp_user_key),
                                  user['username']).group()
                    user['username'] = u
                    user['removal'] = removal.isoformat()
                    user['space_utilization'] = {
                        'total': total,
                        'used': used,
                        'available': total - used,
                    }

                temp_users, err = TempUserSchema().load(temp_users, many=True)
                if err:
                    return {'errors': err}

            return {'users': temp_users}

        @self.app.post('/api/v1/users/<user>/desc')
        def update_desc(user):
            """legacy, eventually move to the patch endpoint"""
            desc = request.body.read().decode('utf-8')

            self.manager.set_user_desc(user, desc)
            return {}

        @self.app.post(['/api/v1/users', '/api/v1/users/'])
        @self.user_manager.admin_view()
        def api_create_user():
            """API enpoint to create a user with schema validation"""
            available_roles = [x for x in self.cork._store.roles]
            users = self.manager.get_users()
            emails = [u[1]['email_addr'] for u in users.items()]
            data = request.json
            err = NewUserSchema().validate(data)

            if 'username' in data and data['username'] in users:
                err.update({'username': 'Username already exists'})

            if 'email' in data and data['email'] in emails:
                err.update({'email': 'Email already exists'})

            if 'role' in data and data['role'] not in available_roles:
                err.update({'role': 'Not a valid choice.'})

            # validate
            if len(err):
                return {'errors': err}

            # create user
            self.cork._store.users[data['username']] = {
                'role': data['role'],
                'hash': self.cork._hash(data['username'],
                                                data['password']).decode('ascii'),
                'email_addr': data['email'],
                'desc': '{{"name":"{name}"}}'.format(name=data.get('name', '')),
                'creation_date': str(datetime.utcnow()),
                'last_login': str(datetime.utcnow()),
            }
            self.cork._store.save_users()

            # add user account defaults
            key = self.manager.user_key.format(user=data['username'])
            now = int(time.time())

            max_size, max_coll = self.redis.hmget('h:defaults',
                                                          ['max_size', 'max_coll'])
            if not max_size:
                max_size = self.manager.default_max_size

            if not max_coll:
                max_coll = self.manager.default_max_coll

            with redis.utils.pipeline(self.redis) as pi:
                pi.hset(key, 'max_size', max_size)
                pi.hset(key, 'max_coll', max_coll)
                pi.hset(key, 'created_at', now)
                pi.hset(key, 'name', data.get('name', ''))
                pi.hsetnx(key, 'size', '0')

            # create initial collection
            self.manager.create_collection(
                data['username'],
                coll=self.manager.default_coll['id'],
                coll_title=self.manager.default_coll['title'],
                desc=self.manager.default_coll['desc'].format(data['username']),
                public=False,
                synthetic=True
            )

            # Check for mailing list management
            if self.manager.mailing_list:
                self.manager.add_to_mailing_list(
                    data['username'],
                    data['email'],
                    data.get('name', ''),
                )

        @self.app.get(['/api/v1/users/<username>', '/api/v1/users/<username>/'])
        @self.user_manager.admin_view()
        def api_get_user(username):
            """API enpoint to return user info"""
            users = self.manager.get_users()

            if username not in users:
                self._raise_error(404, 'No such user')

            user = users[username]

            # assemble space usage
            total = self.manager.get_size_allotment(username)
            used = self.manager.get_size_usage(username)
            user['space_utilization'] = {
                'total': total,
                'used': used,
                'available': total - used,
            }

            user_data, err = UserSchema(exclude=('username',)).load(user)
            colls = self.manager.get_collections(username,
                                                 include_recs=True,
                                                 api=True)

            for coll in colls:
                for rec in coll['recordings']:
                    rec['pages'] = self.manager.list_pages(username,
                                                           coll['id'],
                                                           rec['id'])

            # colls is a list so will always be `many` even if one collection
            collections, err = CollectionSchema().load(colls, many=True)
            user_data['collections'] = collections

            return {'user': user_data}

        @self.app.put(['/api/v1/users/<username>', '/api/v1/users/<username>/'])
        @self.user_manager.auth_view()
        def api_update_user(username):
            """API enpoint to update user info

               See `UserUpdateSchema` for available fields.

               ** bottle 0.12.9 doesn't support `PATCH` methods.. update to
                  patch once availabile.
            """
            users = self.manager.get_users()
            available_roles = [x for x in self.cork._store.roles]

            if username not in users:
                self._raise_error(404, 'No such user')

            # if not admin, check ownership
            if not self.access.is_anon(username) and not self.access.is_superuser():
                self.access.assert_is_curr_user(username)

            user = users[username]
            try:
                json_data = json.loads(request.forms.json)
            except Exception as e:
                print(e)
                return {'errors': 'bad json data'}

            if len(json_data.keys()) == 0:
                return {'errors': 'empty payload'}

            data, err = UserUpdateSchema(only=json_data.keys()).load(json_data)

            if 'role' in data and data['role'] not in available_roles:
                err.update({'role': 'Not a valid choice.'})

            if len(err):
                return {'errors': err}

            if 'name' in data:
                user['desc'] = '{{"name":"{name}"}}'.format(name=data.get('name', ''))

            #
            # restricted resources
            #
            if 'max_size' in data and self.manager.is_superuser():
                key = self.manager.user_key.format(user=username)
                max_size = float(data['max_size'])
                # convert GB to bytes
                max_size = int(max_size * 1000000000)

                with redis.utils.pipeline(self.redis) as pi:
                    pi.hset(key, 'max_size', max_size)

            if 'role' in data and self.manager.is_superuser():
                # set new role or default to base role
                user['role'] = data['role']

            #
            # return updated user data
            #
            total = self.manager.get_size_allotment(username)
            used = self.manager.get_size_usage(username)
            user['space_utilization'] = {
                'total': total,
                'used': used,
                'available': total - used,
            }

            user_data, err = UserSchema(exclude=('username',)).load(user)
            colls = self.manager.get_collections(username,
                                                 include_recs=True,
                                                 api=True)

            for coll in colls:
                for rec in coll['recordings']:
                    rec['pages'] = self.manager.list_pages(username,
                                                           coll['id'],
                                                           rec['id'])

            # colls is a list so will always be `many` even if one collection
            collections, err = CollectionSchema().load(colls, many=True)
            user_data['collections'] = collections

            return {'user': user_data}

        @self.app.delete(['/api/v1/users/<user>', '/api/v1/users/<user>/'])
        @self.user_manager.admin_view()
        def api_delete_user(user):
            """API enpoint to delete a user"""
            if user not in self.manager.get_users():
                self._raise_error(404, 'No such user')

            self.manager.delete_user(user)

        @self.app.get(['/<user>', '/<user>/'])
        @self.jinja2_view('user.html')
        def user_info(user):
            self.redir_host()

            user = self.access.get_user(user)

            if self.access.is_anon(user):
                self.redirect('/' + user.my_id + '/temp')

            if not self.user_manager.is_valid_user(user):
                raise HTTPError(404, 'No Such User')

            result = {
                'user': user.name,
                'user_info': user.serialize(),
                'collections': [coll.serialize() for coll in user.get_collections()],
            }

            if not result['user_info'].get('desc'):
                result['user_info']['desc'] = self.default_user_desc.format(user)

            return result

        # User Account Settings
        @self.app.get('/<username>/_settings')
        @self.jinja2_view('account.html')
        def account_settings(username):
            user = self.access.get_user(username)

            self.access.assert_is_curr_user(user)

            return {'user': username,
                    'user_info': user.serialize(),
                    'num_coll': user.num_collections(),
                   }

        # Delete User Account
        @self.app.post('/<user>/$delete')
        def delete_user(user):
            self.validate_csrf()
            if self.manager.delete_user(user):
                self.flash_message('The user {0} has been permanently deleted!'.format(user), 'success')

                redir_to = '/'
                request.environ['webrec.delete_all_cookies'] = 'all'
                self.cork.logout(success_redirect=redir_to, fail_redirect=redir_to)
            else:
                self.flash_message('There was an error deleting {0}'.format(user))
                self.redirect(self.get_path(user))

        # Expiry Message
        @self.app.route('/_expire')
        def expire():
            self.flash_message('Sorry, the anonymous collection has expired due to inactivity')
            self.redirect('/')

        # Skip POST request recording
        @self.app.get('/_skipreq')
        def skip_req():
            url = request.query.getunicode('url')
            user = self.manager.get_curr_user()
            if not user:
                user = self.manager.get_anon_user()

            self.manager.skip_post_req(user, url)
            return {}

