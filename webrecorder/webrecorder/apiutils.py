from bottle import Bottle

from apispec import APISpec

from collections import defaultdict

import re


# ============================================================================
class WRAPISpec(object):
    RE_URL = re.compile(r'<(?:[^:<>]+:)?([^<>]+)>')

    tags = [
        {'name': 'WASAPI (Downloads)',
         'description': 'Download WARC files API (conforms to WASAPI spec)'},

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

        {'name': 'Uploads',
         'description': 'Upload WARC or HAR files API'},

        {'name': 'Add External Records',
         'description': 'Add External WARC Records API'},

        {'name': 'Browsers',
         'description': 'Browser API'},

        {'name': 'External Archives',
         'description': 'External Archives Info API'},

        {'name': 'Cookies',
         'description': 'Cookie Handling'},

        {'name': 'Bug Reporting',
         'description': 'Bug Reporting API'},

        {'name': 'Admin',
         'description': 'Admin API',
        },

        {'name': 'Stats',
         'description': 'Stats API',
        },

        {'name': 'Automation',
         'description': 'Automation API',
        },

        {'name': 'Behaviors',
         'description': 'Behaviors API'
        },
    ]

    # only include these groups when logged in as admin
    admin_tags = ['Admin', 'Stats', 'Automation']

    string_params = {
        'user': 'User',
        'username': 'User',
        'coll': 'Collection Slug',
        'coll_name': 'Collection Slug',
        'collection': 'Collection Slug',
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
        'filename': 'File Name',
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

    all_responses = {
        'wasapi_list': {
            'description': 'WASAPI response for list of WARC files available for download',
            'content': {
                'application/json': {
                    'schema': {
                        'type': 'object',
                        'properties': {
                            'files': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'content-type': {'type': 'string'},
                                        'filetype': {'type': 'string'},
                                        'filename': {'type': 'string', },
                                        'size': {'type': 'integer'},
                                        'recording': {'type': 'string'},
                                        'recording_date': {'type': 'string'},
                                        'collection': {'type': 'string'},
                                        'checksums': {'type': 'object'},
                                        'locations': {'type': 'array', 'items': {'type': 'string'}},
                                        'is_active': {'type': 'boolean'},
                                    }
                                }
                            },
                            'include-extra': {'type': 'boolean'}
                        }
                    }
                }
            }
        },
        'wasapi_download': {
            'description': 'WARC file',
            'content': {
                'application/warc': {
                    'schema': {
                        'type': 'string',
                        'format': 'binary',
                        'example': 'WARC/1.0\r\nWARC-Type: response\r\n...',
                    }
                }
            }
        }
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
                description='Webrecorder API. This API includes all features available and in use by the frontend.'
            ),
            plugins=[]
        )

        self.admin_spec = APISpec(
            title='Webrecorder',
            version='1.0.0',
            openapi_version='3.0.0',
            info=dict(
                description='Webrecorder API (including Admin). This API includes all features available in Webrecorder, including admin and stats APIs.'
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
        """Returns the open api description of the supplied query parameter name

        :param str name: The name of the query parameter
        :return: A dictionary containing the
        :rtype: dict
        """
        optional = name.startswith('?')
        if optional:
            name = name[1:]
        if name in self.string_params:
            param = {'description': self.string_params[name],
                     'required': not optional,
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

        resp = kwargs.get('resp')
        if resp:
            self.funcs[func]['resp'] = resp

    def get_request(self, req_props, req_desc=None):
        properties = {}

        schema = None

        # make array out of props
        if isinstance(req_props, dict):
            if req_props.get('type') == 'array':
                obj_type = 'array'
                prop_list = req_props['item_type']

            assert (prop_list)

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
                    is_admin = info['tags'][0] in self.admin_tags

                api['responses'] = self.get_responses(info.get('resp', None))

                ops[method] = api

            if not is_admin:
                self.spec.add_path(path=name, operations=ops)

            self.admin_spec.add_path(path=name, operations=ops)

        for tag in self.tags:
            self.admin_spec.add_tag(tag)

            if tag['name'] not in self.admin_tags:
                self.spec.add_tag(tag)
            else:
                print('skip', tag)

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

    def get_api_spec_yaml(self, use_admin=False):
        """Returns the api specification as a yaml string

        :return: The api specification as a yaml string
        :rtype: str
        """
        return self.spec.to_yaml() if not use_admin else self.admin_spec.to_yaml()

    def get_api_spec_dict(self, use_admin=False):
        """Returns the api specification as a dictionary

        :return: The api specification as a dictionary
        :rtype: dict
        """
        return self.spec.to_dict() if not use_admin else self.admin_spec.to_dict()


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
