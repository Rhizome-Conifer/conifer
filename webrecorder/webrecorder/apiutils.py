from bottle import Bottle

from apispec import APISpec

from collections import defaultdict

import re


# ============================================================================
class WRAPISpec(object):
    RE_URL = re.compile(r'<(?:[^:<>]+:)?([^<>]+)>')

    DEFAULT_OBJ = {}

    tags = [
        {'name': 'Collections',
         'description': 'Collection APIs'},

        {'name': 'Recordings',
         'description': 'Recording Session APIs'},
    ]

    string_params = {
        'user': 'User',
        'username': 'User',
        'coll': 'Collection Slug',
        'coll_name': 'Collection Slug',
        'rec': 'Session Id',
        'reqid': 'Remote Browser Request Id',
        'new_coll_name': 'New Collection Name',
        'list_id': 'List Id',
        'bid': 'Bookmark Id',

        'title': 'Title',
        'desc': 'Description',
    }

    opt_bool_params = {
        'public': 'Publicly Accessible',
        'include_recordings': 'Include Recording Sessions in response',
        'include_lists': 'Include all lists in response',
        'include_pages': 'Include pages in response',

        'public_index': 'Publicly Accessible Collection Index',
    }

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

        else:
            raise AssertionError('Param {0} not found'.format(name))
            #param = self.all_params[name].copy()
            #param['name'] = name

        return param

    def get_param_type(self, name):
        if name in self.string_params:
            return {'type': 'string',
                    'description': self.string_params[name]}

        elif name in self.opt_bool_params:
            return {'type': 'boolean',
                    'description': self.opt_bool_params[name]}

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

        json_def = kwargs.get('json')
        if json_def:
            self.funcs[func]['request'] = self.get_request(json_def)

    def get_request(self, json_props):
        properties = {}

        for prop in json_props:
            properties[prop] = self.get_param_type(prop)

        return {'content': {'application/json':
                {'schema': {'type': 'object',
                            'properties': properties}}}}

    def build_api_spec(self):
        for name, routes in self.api_map.items():
            ops = {}
            for method, callback in routes.items():
                info = self.funcs[callback]

                params = info.get('path_params', []) + info.get('query_params', [])

                api = {'parameters': params}

                if method == 'post' or method == 'put':
                    request = info.get('request')
                    if request:
                        api['requestBody'] = request
                else:
                    assert 'request' not in info

                if 'tags' in info:
                    api['tags'] = info['tags']

                # TODO
                api['responses'] = {'200': {}}

                ops[method] = api

            self.spec.add_path(path=name, operations=ops)

        for tag in self.tags:
            self.spec.add_tag(tag)

    def get_api_spec_yaml(self):
        #print(self.funcs[self.api_map['/api/v1/collections']['post']])
        return self.spec.to_yaml()


# ============================================================================
wr_api_spec = WRAPISpec('/api/v1/')


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
