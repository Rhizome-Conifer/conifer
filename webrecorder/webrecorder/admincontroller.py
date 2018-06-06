
import json
import time
import redis
import os
import re

from operator import itemgetter

from bottle import request, HTTPError, response
from datetime import datetime
from re import sub

from webrecorder.basecontroller import BaseController
from webrecorder.models import Stats, User

from datetime import datetime, timedelta


# ============================================================================
class AdminController(BaseController):
    STATS_LABELS = {
        'All Capture Logged In': Stats.ALL_CAPTURE_USER_KEY,
        'All Capture Temp': Stats.ALL_CAPTURE_TEMP_KEY,

        'Replay Logged In': Stats.REPLAY_USER_KEY,
        'Replay Temp': Stats.REPLAY_TEMP_KEY,

        'Patch Logged In': Stats.REPLAY_TEMP_KEY,
        'Patch Temp': Stats.PATCH_TEMP_KEY,

        'Delete Logged In': Stats.DELETE_USER_KEY,
        'Delete Temp': Stats.DELETE_TEMP_KEY,

        'Num Downloads Logged In': Stats.DOWNLOADS_USER_COUNT_KEY,
        'Downloaded Size Logged In': Stats.DOWNLOADS_USER_SIZE_KEY,

        'Num Downloads Temp': Stats.DOWNLOADS_TEMP_COUNT_KEY,
        'Downloaded Size Temp': Stats.DOWNLOADS_TEMP_SIZE_KEY,

        'Num Uploads': Stats.UPLOADS_COUNT_KEY,
        'Uploaded Size': Stats.UPLOADS_SIZE_KEY,

        'Bookmarks Added': Stats.BOOKMARK_ADD_KEY,
        'Bookmarks Changed': Stats.BOOKMARK_MOD_KEY,
        'Bookmarks Deleted': Stats.BOOKMARK_DEL_KEY,

        'Num Temp Collections Added': Stats.TEMP_MOVE_COUNT_KEY,
        'Temp Collection Size Added': Stats.TEMP_MOVE_SIZE_KEY,
    }

    # Custom Stats
    USER_TABLE = 'User Table'
    TEMP_TABLE = 'Temp Table'

    ACTIVE_SESSIONS = 'Active Sessions'

    USER_LOGINS = 'User-Logins-Any'
    USER_LOGINS_100 = 'User-Logins-100MB'
    USER_LOGINS_1000 = 'User-Logins-1GB'

    PUBLIC_COLLS = 'Collections Public'

    CACHE_TTL = 600
    CACHE_USER_TABLE = 'stc:users'

    def __init__(self, *args, **kwargs):
        super(AdminController, self).__init__(*args, **kwargs)
        config = kwargs['config']

        self.default_user_desc = config['user_desc']
        self.user_usage_key = config['user_usage_key']
        self.temp_usage_key = config['temp_usage_key']
        #self.temp_user_key = config['temp_prefix']
        self.tags_key = config['tags_key']

        self.temp_user_key = 'u:{0}'.format(User.TEMP_PREFIX)
        self.temp_user_search = 'u:{0}*:info'.format(User.TEMP_PREFIX)

        self.announce_list = os.environ.get('ANNOUNCE_MAILING_LIST_ENDPOINT', False)

        self.session_redis = kwargs.get('session_redis')

        self.init_all_stats()

    def init_all_stats(self):
        self.all_stats = {}

        for name, key in self.STATS_LABELS.items():
            self.all_stats[name] = key

        for key in self.redis.scan_iter(Stats.BROWSERS_KEY.format('*')):
            name = 'Browser ' + key[len(Stats.BROWSERS_KEY.format('')):]
            self.all_stats[name] = key

        for key in self.redis.scan_iter(Stats.SOURCES_KEY.format('*')):
            name = 'Sources ' + key[len(Stats.SOURCES_KEY.format('')):]
            self.all_stats[name] = key

        self.all_stats[self.USER_TABLE] = self.USER_TABLE
        self.all_stats[self.TEMP_TABLE] = self.TEMP_TABLE

        self.all_stats[self.USER_LOGINS] = self.USER_LOGINS
        self.all_stats[self.USER_LOGINS_100] = self.USER_LOGINS_100
        self.all_stats[self.USER_LOGINS_1000] = self.USER_LOGINS_1000

        self.all_stats[self.ACTIVE_SESSIONS] = self.ACTIVE_SESSIONS

    def admin_view(self, function):
        def check_access(*args, **kwargs):
            if not self.access.is_superuser():
                self._raise_error(404)

            return function(*args, **kwargs)

        return check_access

    def grafana_time_stats(self, req):
        req = request.json or {}
        from_var = req['range']['from'][:10]
        to_var = req['range']['to'][:10]

        from_dt = datetime.strptime(from_var, '%Y-%m-%d')
        to_dt = datetime.strptime(to_var, '%Y-%m-%d')
        td = timedelta(days=1)

        dates = []
        timestamps = []

        while from_dt <= to_dt:
            dates.append(from_dt.date().isoformat())
            timestamps.append(from_dt.timestamp() * 1000)
            from_dt += td

        resp = [self.load_series(target, dates, timestamps) for target in req['targets']]

        return resp

    def load_series(self, target, dates, timestamps):
        if target['type'] == 'timeserie':
            name = target.get('target', '')
            if name == self.ACTIVE_SESSIONS:
                return self.load_active_sessions(name)

            elif name == self.USER_LOGINS:
                return self.load_user_logins(name, dates, timestamps)

            elif name == self.USER_LOGINS_100:
                return self.load_user_logins(name, dates, timestamps, 100000000)

            elif name == self.USER_LOGINS_1000:
                return self.load_user_logins(name, dates, timestamps, 1000000000)

            return self.load_time_series(name, dates, timestamps)

        elif target['type'] == 'table':
            if target['target'] == self.USER_TABLE:
                return self.load_user_table()
            elif target['target'] == self.TEMP_TABLE:
                return self.load_temp_table()

        return {}

    def load_time_series(self, key, dates, timestamps):
        datapoints = []

        redis_key = self.all_stats.get(key, 'st:' + key)

        if dates:
            results = self.redis.hmget(redis_key, dates)
        else:
            results = []

        for count, ts in zip(results, timestamps):
            count = int(count or 0)
            datapoints.append((count, ts))

        return {'target': key,
                'datapoints': datapoints
               }

    def load_temp_table(self):
        columns = [
            {'text': 'Id', 'type': 'string'},
            {'text': 'Size', 'type': 'number'},
            {'text': 'Creation Date', 'type': 'time'},
            {'text': 'Updated Date', 'type': 'time'},
        ]

        column_keys = ['size', 'created_at', 'updated_at']

        users = []

        for user_key in self.redis.scan_iter(self.temp_user_search, count=100):
            user_data = self.redis.hmget(user_key, column_keys)
            user_data.insert(0, user_key.split(':')[1])
            user_data[1] = int(user_data[1])
            user_data[2] = self.parse_iso_or_ts(user_data[2])
            user_data[3] = self.parse_iso_or_ts(user_data[3])

            users.append(user_data)

        return {'columns': columns,
                'rows': users,
                'type': 'table'
               }

    def fetch_user_table(self):
        users = self.redis.get(self.CACHE_USER_TABLE)
        if users:
            return json.loads(users)

        column_keys = ['size', 'max_size', 'last_login', 'creation_date', 'updated_at', 'role', 'email_addr']

        users = []

        for user_key in self.redis.scan_iter('u:*:info', count=100):
            if user_key.startswith(self.temp_user_key):
                continue

            user_data = self.redis.hmget(user_key, column_keys)

            user_data.insert(0, user_key.split(':')[1])
            user_data[1] = int(user_data[1])
            user_data[2] = int(user_data[2])
            user_data[3] = self.parse_iso_or_ts(user_data[3])
            user_data[4] = self.parse_iso_or_ts(user_data[4])
            user_data[5] = self.parse_iso_or_ts(user_data[5])

            users.append(user_data)

        self.redis.setex(self.CACHE_USER_TABLE, self.CACHE_TTL, json.dumps(users))

        return users

    def load_user_table(self):
        columns = [
            {'text': 'Id', 'type': 'string'},
            {'text': 'Size', 'type': 'number'},
            {'text': 'Max Size', 'type': 'number'},
            {'text': 'Last Login Date', 'type': 'time'},
            {'text': 'Creation Date', 'type': 'time'},
            {'text': 'Updated Date', 'type': 'time'},
            {'text': 'Role', 'type': 'string'},
            {'text': 'Email', 'type': 'string'},
        ]

        return {'columns': columns,
                'rows': self.fetch_user_table(),
                'type': 'table'
               }

    def load_active_sessions(self, key):
        ts = int(datetime.utcnow().timestamp()) * 1000

        num_sessions = sum(1 for i in self.session_redis.scan_iter('sesh:*', count=10))

        datapoints = [[num_sessions, ts]]

        return {'target': key,
                'datapoints': datapoints
               }

    def load_user_logins(self, key, dates, timestamps, size_threshold=None):
        date_bucket = {}

        for user_data in self.fetch_user_table():
            if size_threshold is not None and user_data[1] < size_threshold:
                continue

            dt = datetime.utcfromtimestamp(user_data[3] / 1000)
            dt = dt.date().isoformat()

            date_bucket[dt] = date_bucket.get(dt, 0) + 1

        datapoints = []
        for dt, ts in zip(dates, timestamps):
            count = date_bucket.get(dt, 0)
            datapoints.append((count, ts))

        return {'target': key,
                'datapoints': datapoints
               }

    @classmethod
    def parse_iso_or_ts(self, value):
        try:
            return int(value) * 1000
        except:
            pass

        try:
            return int(datetime.strptime(value[:19], '%Y-%m-%d %H:%M:%S').timestamp()) * 1000
        except:
            return 0

    def init_routes(self):
        @self.app.get('/api/v1/admin/defaults')
        @self.admin_view
        def get_defaults():
            data = self.redis.hgetall('h:defaults')
            data['max_size'] = int(data['max_size'])
            data['max_anon_size'] = int(data['max_anon_size'])
            return {'defaults': data}

        @self.app.put('/api/v1/admin/defaults')
        def update_defaults():
            data = request.json
            if 'max_size' in data:
                try:
                    self.redis.hset('h:defaults', 'max_size', int(data['max_size']))
                except Exception as e:
                    return {'error': 'error setting max_size'}

            if 'max_anon_size' in data:
                try:
                    self.redis.hset('h:defaults', 'max_anon_size', int(data['max_anon_size']))
                except Exception as e:
                    return {'error': 'error setting max_anon_size'}

            data = self.redis.hgetall('h:defaults')
            data['max_size'] = int(data['max_size'])
            data['max_anon_size'] = int(data['max_anon_size'])
            return {'defaults': data}

        @self.app.get('/api/v1/admin/user_roles')
        @self.admin_view
        def api_get_user_roles():
            return {"roles": self.user_manager.get_roles()}

        @self.app.get('/api/v1/admin/dashboard')
        @self.admin_view
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

        @self.app.get('/api/v1/admin/users')
        @self.admin_view
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

        @self.app.get('/api/v1/admin/temp-users')
        @self.admin_view
        def temp_users():
            """ Resource returning active temp users
            """
            temp_user_keys = list(self.redis.scan_iter(self.temp_user_search))

            temp_user_data = []

            for user_key in temp_user_keys:
                username = user_key.split(':')[1]

                user = self.user_manager.all_users[username]
                if not user or not user.get_prop('created_at'):
                    continue

                temp_user_data.append(user.serialize(compute_size_allotment=True))

            return {'users': temp_user_data}

        @self.app.post('/api/v1/admin/users')
        @self.admin_view
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

            user, first_coll = res
            return {'user': user.name, 'first_coll': first_coll.name if first_coll else ''}

        @self.app.put('/api/v1/admin/user/<username>')
        @self.admin_view
        def api_update_user(username):
            """API enpoint to update user info (full access)
            """
            user = self.get_user(user=username)

            errs = self.user_manager.update_user_as_admin(user, request.json)

            if errs:
                return {'errors': errs}

            return {'user': user.serialize(compute_size_allotment=True)}

        # Grafana Stats APIs
        @self.app.get('/api/v1/stats/')
        @self.admin_view
        def stats_ping():
            return {}

        @self.app.post('/api/v1/stats/search')
        @self.admin_view
        def stats_search():
            stats = sorted(list(self.all_stats.keys()))

            response.content_type = 'application/json'
            return json.dumps(stats)

        @self.app.post('/api/v1/stats/query')
        @self.admin_view
        def stats_query():
            stats = self.grafana_time_stats(request.json)
            response.content_type = 'application/json'
            return json.dumps(stats)


        @self.app.post('/api/v1/stats/annotations')
        @self.admin_view
        def stats_annotations():
            return []



