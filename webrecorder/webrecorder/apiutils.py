from bottle import Bottle

from apispec import APISpec

from collections import defaultdict

import re


# ============================================================================
class WRAPISpec(object):
    RE_URL = re.compile(r'<(?:[^:<>]+:)?([^<>]+)>')

    tags = [
        {'name': 'Auth',
         'description': 'Auth and Login API'},

        {'name': 'Users',
         'description': 'User API'},

        {'name': 'Collections',
         'description': 'Collection API'},

        {'name': 'Recordings',
         'description': 'Recording Sessions Management API'},

        {'name': 'Lists',
         'description': 'List API'},

        {'name': 'Bookmarks',
         'description': 'Bookmarks API'},

        {'name': 'Browsers',
         'description': 'Browser API'},

        {'name': 'External Archives',
         'description': 'External Archives Info API'},

        {'name': 'Cookies',
         'description': 'Cookie Handling'},

        {'name': 'Bug Reporting',
         'description': 'Bug Reporting API'},

        {'name': 'Admin',
         'description': 'Admin API'},

        {'name': 'Stats',
         'description': 'Stats API'},
      ]

    string_params = {
        'user': 'User',
        'username': 'User',
        'coll': 'Collection Slug',
        'coll_name': 'Collection Slug',
        'rec': 'Session Id',
        'reqid': 'Remote Browser Request Id',
        'new_coll_name': 'New Collection Name',
        'list': 'List Id',
        'list_id': 'List Id',
        'bid': 'Bookmark Id',
        'autoid': 'Automation Id',

        'title': 'Title',
        'desc': 'Description',
        'url': 'Archived Url',
        'timestamp': 'Archived at Timestamp',
        'browser': 'Browser Used',
        'page_id': 'Page Id',
        'upload_id': 'Upload Id',
    }

    opt_bool_params = {
        'public': 'Publicly Accessible',
        'include_recordings': 'Include Recording Sessions in response',
        'include_lists': 'Include all lists in response',
        'include_pages': 'Include pages in response',
        'include_bookmarks': 'Include bookmarks in response',

        'public_index': 'Publicly Accessible Collection Index',
    }

    custom_params = {
        'before_id': {'type': 'string',
                      'description': 'Insert Before this Id',
                     },

        'order': {'type': 'array',
                  'items': {'type': 'string'},
                  'description': 'an array of existing ids in new order'
                 }
    }

    all_responses = {}


    @classmethod
    def bottle_path_to_openapi(cls, path):
        path_vars = cls.RE_URL.findall(path)
        path = cls.RE_URL.sub(r'{\1}', path)
        return path, path_vars

    def __init__(self, api_root):
        self.api_root = api_root
        self.api_map = defaultdict(dict)
        self.funcs = defaultdict(dict)

        self.curr_tag = ''

        self.spec = APISpec(
            title='Webrecorder',
            version='1.0.0',
            openapi_version='3.0.0',
            info=dict(
                description='Webrecorder API'
            ),
            plugins=[]
        )

        self.err_400 = self.make_err_response('Invalid Request Param')
        self.err_404 = self.make_err_response('Object Not Found')
        self.err_403 = self.make_err_response('Invalid Authorization')
        self.any_obj = self.make_any_response()

    def set_curr_tag(self, tag):
        self.curr_tag = tag

    def add_route(self, route):
        if route.rule.startswith(self.api_root):
            path, path_vars = self.bottle_path_to_openapi(route.rule)

            self.api_map[path][route.method.lower()] = route.callback

            self.funcs[route.callback]['path'] = path,
            self.funcs[route.callback]['path_params'] = self.make_params(path_vars, 'path')
            if self.curr_tag:
                self.funcs[route.callback]['tags'] = [self.curr_tag]

    def get_param(self, name):
        if name in self.string_params:
            param = {'description': self.string_params[name],
                     'required': True,
                     'schema': {'type': 'string'},
                     'name': name
                    }

        elif name in self.opt_bool_params:
            param = {'description': self.opt_bool_params[name],
                     'required': False,
                     'schema': {'type': 'boolean'},
                     'name': name
                    }

        elif name in self.custom_params:
            param = self.custom_params[name].copy()
            param['name'] = name

        else:
            raise AssertionError('Param {0} not found'.format(name))

        return param

    def get_req_param(self, name):
        if name in self.string_params:
            return {'type': 'string',
                    'description': self.string_params[name]}

        elif name in self.opt_bool_params:
            return {'type': 'boolean',
                    'description': self.opt_bool_params[name]}

        elif name in self.custom_params:
            return self.custom_params[name]

        raise AssertionError('Param {0} not found'.format(name))

    def make_params(self, params, param_type):
        objs = []
        for param in params:
            obj = self.get_param(param)
            obj['in'] = param_type
            objs.append(obj)

        return objs

    def add_func(self, func, kwargs):
        query = kwargs.get('query')
        if query:
            self.funcs[func]['query_params'] = self.make_params(query, 'query')

        req = kwargs.get('req')
        if req:
            self.funcs[func]['request'] = self.get_request(req, kwargs.get('req_desc'))

    def get_request(self, req_props, req_desc=None):
        properties = {}

        schema = None

        # make array out of props
        if isinstance(req_props, dict):
            if req_props.get('type') == 'array':
                obj_type = 'array'
                prop_list = req_props['item_type']

            assert(prop_list)

        else:
            obj_type = 'object'
            prop_list = req_props

        if not schema:
            for prop in prop_list:
                properties[prop] = self.get_req_param(prop)

            schema = {'type': 'object',
                      'properties': properties}

            # wrap schema in array
            if obj_type == 'array':
                schema = {'type': 'array',
                          'items': schema}

        request = {'content': {'application/json':
                    {'schema': schema}
                  }}

        if req_desc:
            request['description'] = req_desc

        return request

    def build_api_spec(self):
        for name, routes in self.api_map.items():
            ops = {}
            for method, callback in routes.items():
                info = self.funcs[callback]

                # combine path params and query params, if any
                params = info.get('path_params', []) + info.get('query_params', [])

                api = {'parameters': params}

                # for POST and PUT, generate requestBody
                if method == 'post' or method == 'put':
                    request = info.get('request')
                    if request:
                        api['requestBody'] = request
                else:
                # otherwise, ensure no request body!
                    assert 'request' not in info

                # set tags, if any
                if 'tags' in info:
                    api['tags'] = info['tags']

                api['responses'] = self.get_responses(None)

                ops[method] = api

            self.spec.add_path(path=name, operations=ops)

        for tag in self.tags:
            self.spec.add_tag(tag)

    def get_responses(self, obj_type):
        response_obj = self.all_responses.get(obj_type) or self.any_obj
        obj = {'400': self.err_400,
               '404': self.err_404,
               '200': response_obj
              }

        return obj

    def make_err_response(self, msg):
        obj = {'description': msg,
               'content': {'application/json':
                    {'schema': {'type': 'object',
                                'properties': {'error':
                                                {'type': 'string'}}
                                              }}}}

        return obj

    def make_any_response(self):
        obj = {'description': 'Any Object',
               'content': {'application/json':
                    {'schema': {'type': 'object',
                                'additionalProperties': True}}}}

        return obj

    def get_api_spec_yaml(self):
        return self.spec.to_yaml()


# ============================================================================
class APIBottle(Bottle):
    def add_route(self, route):
        super(APIBottle, self).add_route(route)
        wr_api_spec.add_route(route)


# ============================================================================
def api_decorator(**kwargs):
    def wrapper(func):
        wr_api_spec.add_func(func, kwargs)
        return func

    return wrapper


# ============================================================================
wr_api_spec = WRAPISpec('/api/v1/')


