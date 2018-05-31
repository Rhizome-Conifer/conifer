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

    def init_routes(self):
        @self.app.post('/api/v1/collections')
        def create_collection():
            user = self.get_user(api=True, redir_check=False)

            title = request.json.get('title')

            coll_name = self.sanitize_title(title)

            if not coll_name:
                self._raise_error(400, 'invalid_coll_name')

            is_public = request.json.get('public')

            if self.access.is_anon(user):
                if coll_name != 'temp':
                    self._raise_error(400, 'invalid_temp_coll_name')

                if user.has_collection(coll_name):
                    self._raise_error(400, 'duplicate_name')

            try:
                collection = user.create_collection(coll_name, title=title,
                                                    desc='', public=is_public)

                self.flash_message('Created collection <b>{0}</b>!'.format(collection.get_prop('title')), 'success')
                resp = {'collection': collection.serialize()}

            except DupeNameException as de:
                self._raise_error(400, 'duplicate_name')

            except Exception as ve:
                print(ve)
                self.flash_message(str(ve))
                self._raise_error(400, 'duplicate_name')

            return resp

        @self.app.get('/api/v1/collections')
        def get_collections():
            user = self.get_user(api=True, redir_check=False)

            kwargs = {'include_recordings': get_bool(request.query.get('include_recordings')),
                      'include_lists': get_bool(request.query.get('include_lists')),
                      'include_pages': get_bool(request.query.get('include_pages')),
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

            errs = user.remove_collection(collection, delete=True)
            if errs.get('error'):
                return self._raise_error(400, errs['error'])
            else:
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
                    new_coll_name = user.colls.rename(collection, new_coll_name, allow_dupe=False)
                except DupeNameException as de:
                    self._raise_error(400, 'duplicate_name')

                collection['title'] = new_coll_title

            if 'desc' in data:
                collection['desc'] = data['desc']


            # TODO: notify the user if this is a request from the admin panel
            if 'public' in data:
                #if self.access.is_superuser() and data.get('notify'):
                #    pass
                collection.set_public(data['public'])

            if 'public_index' in data:
                collection.set_bool_prop('public_index', data['public_index'])

            if 'featured_list' in data:
                blist = collection.get_list(data['featured_list'])
                if not blist:
                    self._raise_error(400, 'no_such_list')

                collection['featured_list'] = data['featured_list']

            return {'collection': collection.serialize()}

        @self.app.get('/api/v1/collection/<coll_name>/page_bookmarks')
        def get_page_bookmarks(coll_name):
            user, collection = self.load_user_coll(coll_name=coll_name)

            rec = request.query.get('rec')
            if rec:
                recording = collection.get_recording(rec)
                if not recording:
                    return {'page_bookmarks': {}}

                rec_pages = collection.list_rec_pages(recording)
            else:
                rec_pages = None

            return {'page_bookmarks': collection.get_all_page_bookmarks(rec_pages)}

        # Create Collection
        #@self.app.get('/_create')
        #@self.jinja2_view('create_collection.html')
        def create_coll_view():
            self.access.assert_is_logged_in()
            return {}

        #@self.app.post('/_create')
        def create_coll_post():
            title = self.post_get('title')
            if not title:
                self.flash_message('Title is required')
                self.redirect('/_create')

            is_public = self.post_get('public') == 'on'

            coll_name = self.sanitize_title(title)

            try:
                if not coll_name:
                    raise ValidationException('invalid_name')

                user = self.access.session_user
                user.create_collection(coll_name, title=title, desc='', public=is_public)

                self.flash_message('Created collection <b>{0}</b>!'.format(title), 'success')
                redir_to = self.get_redir_back('/_create')

            except DupeNameException as de:
                self._raise_error(400, 'duplicate_name')

            except Exception as ve:
                import traceback
                traceback.print_exc()
                self.flash_message(str(ve))
                redir_to = '/_create'

            self.redirect(redir_to)

        #@self.app.post(['/_delete_coll'])
        def delete_collection_post():
            self.validate_csrf()
            user, collection = self.load_user_coll()

            success = None
            try:
                success = user.remove_collection(collection, delete=True)
            except Exception as e:
                print(e)

            if success == {}:
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
            #rec_list = [self.sanitize_title(title) for title in rec_list.split(',')]
            return self.get_collection_info_for_view(user, coll_name)

    def get_collection_info_for_view(self, user, coll_name):
        self.redir_host()

        result = self.get_collection_info(coll_name, user=user, include_pages=True)

        result['coll'] = result['collection']['id']
        result['coll_name'] = result['coll']
        result['coll_title'] = quote(result['collection']['title'])

        #if not result or result.get('error'):
        #    self._raise_error(404, 'Collection not found')

        return result

    def get_collection_info(self, coll_name, user=None, include_pages=False):
        user, collection = self.load_user_coll(user=user, coll_name=coll_name)

        result = {'collection': collection.serialize(include_rec_pages=include_pages,
                                                     include_lists=True,
                                                     include_recordings=True,
                                                     include_pages=True,
                                                     check_slug=coll_name)}

        result['user'] = user.my_id
        result['size_remaining'] = user.get_size_remaining()

        return result
