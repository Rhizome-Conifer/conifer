from bottle import request, response
from six.moves.urllib.parse import quote

from webrecorder.basecontroller import BaseController
from webrecorder.webreccork import ValidationException

from webrecorder.models.base import DupeNameException
from webrecorder.utils import get_bool


# ============================================================================
class CollsController(BaseController):
    def __init__(self, *args, **kwargs):
        super(CollsController, self).__init__(*args, **kwargs)
        config = kwargs['config']
        self.default_coll_desc = config['coll_desc']

    def init_routes(self):
        @self.app.post('/api/v1/collections')
        def create_collection():
            user = self.get_user(api=True, redir_check=False)

            title = request.json.get('title')

            coll_name = self.sanitize_title(title)

            if not coll_name:
                return {'error_message': 'Invalid Collection Name'}

            is_public = request.json.get('public')

            if self.access.is_anon(user):
                if coll_name != 'temp':
                    return {'error_message': 'Only temp collection available'}

                if user.has_collection(coll_name):
                    return {'error_message': 'Temp collection already exists'}

            try:
                collection = user.create_collection(coll_name, title=title,
                                                    desc='', public=is_public)

                self.flash_message('Created collection <b>{0}</b>!'.format(collection.get_prop('title')), 'success')
                resp = {'collection': collection.serialize()}

            except DupeNameException as de:
                resp = {'error_message': 'duplicate name: ' + coll_name}

            except Exception as ve:
                print(ve)
                self.flash_message(str(ve))
                resp = {'error_message': str(ve)}

            return resp

        @self.app.get('/api/v1/collections')
        def get_collections():
            user = self.get_user(api=True, redir_check=False)

            kwargs = {'include_recordings': get_bool(request.query.get('include_recordings', 'true')),
                      'include_lists': get_bool(request.query.get('include_lists', 'true'))
                     }

            collections = user.get_collections()

            return {'collections': [coll.serialize(**kwargs) for coll in collections]}

        @self.app.get('/api/v1/collection/<coll_name>')
        def get_collection(coll_name):
            user = self.get_user(api=True, redir_check=False)

            return self.get_collection_info(coll_name, user=user)

        @self.app.delete('/api/v1/collection/<coll_name>')
        def delete_collection(coll_name):
            user, collection = self.load_user_coll(coll_name=coll_name)

            if user.remove_collection(collection, delete=True):
                return {'deleted_id': coll_name}

        @self.app.post('/api/v1/collection/<coll_name>')
        def update_collection(coll_name):
            user, collection = self.load_user_coll(coll_name=coll_name)

            self.access.assert_can_admin_coll(collection)

            data = request.json or {}

            if 'title' in data:
                new_coll_title = data['title']
                new_coll_name = self.sanitize_title(new_coll_title)

                try:
                    new_coll_name = user.rename(collection, new_coll_name)
                except DupeNameException as de:
                    return {'error_message': 'duplicate name: ' + new_coll_name}

                collection['title'] = new_coll_title

            if 'desc' in data:
                collection['desc'] = data['desc']


            # TODO: notify the user if this is a request from the admin panel
            if 'public' in data:
                #if self.access.is_superuser() and data.get('notify'):
                #    pass
                self.access.set_public(collection, data['public'])

            if 'featured_list' in data:
                blist = collection.get_list(data['featured_list'])
                if not blist:
                    response.status = 400
                    return {'error': 'no_such_list'}

                collection['featured_list'] = data['featured_list']

            return {'collection': collection.serialize()}

        @self.app.get('/api/v1/collection/<coll_name>/is_public')
        def is_public(coll_name):
            user, collection = self.load_user_coll(coll_name=coll_name)

            # check ownership
            if not self.access.can_admin_coll(collection):
                self._raise_error(404, 'Collection not found', api=True)

            return {'is_public': self.access.is_public(collection)}

        @self.app.get('/api/v1/collection/<coll_name>/num_pages')
        def get_num_pages(coll_name):
            user, collection = self.load_user_coll(coll_name)

            return {'count': collection.count_pages()}

        # Create Collection
        @self.app.get('/_create')
        @self.jinja2_view('create_collection.html')
        def create_coll_view():
            self.access.assert_is_logged_in()
            return {}

        @self.app.post('/_create')
        def create_coll_post():
            title = self.post_get('title')
            if not title:
                self.flash_message('Title is required')
                self.redirect('/_create')

            is_public = self.post_get('public') == 'on'

            coll_name = self.sanitize_title(title)

            try:
                if not coll_name:
                    raise ValidationException('Invalid Collection Name')

                user = self.access.session_user
                user.create_collection(coll_name, title=title, desc='', public=is_public)

                self.flash_message('Created collection <b>{0}</b>!'.format(title), 'success')
                redir_to = self.get_redir_back('/_create')

            except DupeNameException as de:
                self._raise_error(400, 'Duplicate Name: ' + coll_name)

            except Exception as ve:
                import traceback
                traceback.print_exc()
                self.flash_message(str(ve))
                redir_to = '/_create'

            self.redirect(redir_to)

        @self.app.post(['/_delete_coll'])
        def delete_collection_post():
            self.validate_csrf()
            user, collection = self.load_user_coll()

            success = False
            try:
                success = user.remove_collection(collection, delete=True)
            except Exception as e:
                print(e)

            if success:
                self.flash_message('Collection {0} has been deleted!'.format(collection.name), 'success')

                # if anon user/temp collection, delete user and redirect to homepage
                if self.access.is_anon(user):
                    self.get_session().delete()

                    if self.content_host:
                        self.redir_host(self.content_host, '/_clear_session?path=/')
                    else:
                        self.redirect('/')
                else:
                    self.redirect(self.get_path(user.name))

            else:
                self.flash_message('There was an error deleting {0}'.format(collection.name))
                self.redirect(self.get_path(user.name, collection.name))

        # Collection view (all recordings)
        @self.app.get(['/<user>/<coll_name>', '/<user>/<coll_name>/'])
        @self.jinja2_view('collection_info.html')
        def coll_info(user, coll_name):
            return self.get_collection_info_for_view(user, coll_name)

        @self.app.get(['/<user>/<coll_name>/<rec_list:re:([\w,-]+)>', '/<user>/<coll_name>/<rec_list:re:([\w,-]+)>/'])
        @self.jinja2_view('collection_info.html')
        def coll_info(user, coll_name, rec_list):
            rec_list = [self.sanitize_title(title) for title in rec_list.split(',')]
            return self.get_collection_info_for_view(user, coll_name, rec_list)

    def get_collection_info_for_view(self, user, coll_name, rec_list=None):
        self.redir_host()

        result = self.get_collection_info(coll_name, user=user,
                                          rec_list=rec_list)
        if not result or result.get('error_message'):
            self._raise_error(404, 'Collection not found')

        return result

    def get_collection_info(self, coll_name, user=None, rec_list=None):
        user, collection = self.load_user_coll(user=user, coll_name=coll_name)

        result = {'collection': collection.serialize()}

        result['user'] = user.my_id
        result['size_remaining'] = user.get_size_remaining()
        result['coll'] = collection.name
        result['coll_name'] = collection.name
        result['coll_title'] = quote(result['collection']['title'])

        result['pages'] = collection.list_coll_pages()

        if not result['collection'].get('desc'):
            result['collection']['desc'] = self.default_coll_desc.format(result['coll_title'])

        # rec_list = rec_list or []
        # result['rec_list'] = [rec.serialize() for rec in rec_list]

        return result
