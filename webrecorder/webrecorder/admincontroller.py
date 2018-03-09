
import json
import time
import redis
import os
import re

from operator import itemgetter

from bottle import request, HTTPError
from datetime import datetime, timedelta
from re import sub

from webrecorder.basecontroller import BaseController
from webrecorder.webreccork import ValidationException


# ============================================================================
class AdminController(BaseController):
    def __init__(self, *args, **kwargs):
        super(AdminController, self).__init__(*args, **kwargs)
        config = kwargs['config']

        self.cork = kwargs['cork']

        self.default_user_desc = config['user_desc']
        self.user_usage_key = config['user_usage_key']
        self.temp_usage_key = config['temp_usage_key']
        self.temp_user_key = config['temp_prefix']
        self.tags_key = config['tags_key']
        self.announce_list = os.environ.get('ANNOUNCE_MAILING_LIST_ENDPOINT', False)

    def init_routes(self):
        @self.app.route(['/api/v1/settings'], ['GET', 'PUT'])
        @self.user_manager.admin_view()
        def internal_settings():
            settings = {}
            config = self.redis.hgetall('h:defaults')

            if request.method == 'PUT':
                data = json.loads(request.forms.json)
                config.update(data['settings'])
                # commit to redis
                self.redis.hmset('h:defaults', config)

            settings['defaults'] = config
            return settings

        @self.app.get(['/api/v1/user_roles', '/api/v1/user_roles/'])
        @self.user_manager.admin_view()
        def api_get_user_roles():
            return {"roles": [x for x in self.cork._store.roles]}

        @self.app.get(['/api/v1/dashboard', '/api/v1/dashboard/'])
        @self.user_manager.admin_view()
        def api_dashboard():
            cache_key = self.cache_template.format('dashboard')
            expiry = 5 * 60  # 5 min

            cache = self.redis.get(cache_key)

            if cache:
                return json.loads(cache)

            users = self.user_manager.all_users

            temp = self.redis.hgetall(self.temp_usage_key)
            user = self.redis.hgetall(self.user_usage_key)
            temp = [(k, int(v)) for k, v in temp.items()]
            user = [(k, int(v)) for k, v in user.items()]

            all_collections = []
            for username in users:
                u = self.get_user(user=username)
                all_collections.extend(
                    [c.serialize() for c in u.get_collections()]
                )

            data = {
                'user_count': len(users),
                'collections': all_collections,
                'temp_usage': sorted(temp, key=itemgetter(0)),
                'user_usage': sorted(user, key=itemgetter(0)),
            }

            self.redis.setex(cache_key, expiry,
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
            users = sorted(self.user_manager.all_users,
                           key=sort_by,
                           reverse=reverse)

            return {'users': [self.user_manager.all_users[user].serialize(compute_size_allotment=True) for user in users]}

        @self.app.get('/api/v1/temp-users')
        @self.user_manager.admin_view()
        def temp_users():
            """ Resource returning active temp users
            """
            temp_user_keys = list(self.redis.scan_iter('u:{0}*:info'.format(self.temp_user_key)))

            temp_user_data = []

            for user_key in temp_user_keys:
                username = user_key.split(':')[1]

                user = self.user_manager.all_users[username]
                if not user or not user.get_prop('created_at'):
                    continue

                temp_user_data.append(user.serialize(compute_size_allotment=True))

            return {'users': temp_user_data}

        @self.app.post(['/api/v1/users', '/api/v1/users/'])
        @self.user_manager.admin_view()
        def api_create_user():
            """API enpoint to create a user"""
            data = request.json

            errs, res = self.user_manager.create_user_as_admin(
                email=data['email'],
                username=data['username'],
                role=data['role'],
                passwd=data['password'],
                passwd2=data['password'],
                name=data.get('name', ''))

            # validate
            if errs:
                return {'errors': errs}

            return {'user': res[0].name, 'first_coll': res[1].name if res[1] else ''}

        @self.app.put(['/api/v1/users/<username>', '/api/v1/users/<username>/'])
        @self.user_manager.admin_view()
        def api_update_user(username):
            """API enpoint to update user info (full access)
            """
            user = self.get_user(user=username)

            errs = self.user_manager.update_user_as_admin(user, request.json)

            if errs:
                return {'errors': errs}

            return {'user': user.serialize(compute_size_allotment=True)}
