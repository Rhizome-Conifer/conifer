from bottle import request, response
from six.moves.urllib.parse import quote
import os
import datetime

from webrecorder.basecontroller import BaseController, wr_api_spec
from webrecorder.webreccork import ValidationException

from webrecorder.models.base import DupeNameException
from webrecorder.models.datshare import DatShare
from webrecorder.utils import get_bool
from pywb.warcserver.index.cdxobject import CDXObject


# ============================================================================
class CollsController(BaseController):
    def __init__(self, *args, **kwargs):
        super(CollsController, self).__init__(*args, **kwargs)
        config = kwargs['config']

        self.solr_mgr = kwargs.get('solr_mgr')

        self.allow_external = get_bool(os.environ.get('ALLOW_EXTERNAL', False))
        self.is_search_auto = get_bool(os.environ.get('SEARCH_AUTO', False))

    def init_routes(self):
        wr_api_spec.set_curr_tag('Collections')

        @self.app.post('/api/v1/collections')
        @self.api(
            query=['user'],
            req=['title', 'public', 'public_index'],
            resp='collection')
        def create_collection():
            user = self.get_user(api=True, redir_check=False)

            data = request.json or {}

            title = data.get('title', '')

            coll_name = self.sanitize_title(title)

            if not coll_name:
                self._raise_error(400, 'invalid_coll_name')

            is_public = data.get('public', False)

            is_public_index = data.get('public_index', False)

            is_external = data.get('external', False)

            is_anon = self.access.is_anon(user)

            if is_external:
                if not self.allow_external:
                    self._raise_error(403, 'external_not_allowed')

                #if not is_anon:
                #    self._raise_error(400, 'not_valid_for_external')

            elif is_anon:
                if coll_name != 'temp':
                    self._raise_error(400, 'invalid_temp_coll_name')

            if user.has_collection(coll_name):
                self._raise_error(400, 'duplicate_name')

            try:
                collection = user.create_collection(coll_name, title=title,
                                                    desc='', public=is_public,
                                                    public_index=is_public_index)

                if is_external:
                    collection.set_external(True)

                # if auto-indexing is on, mark new collections as auto-indexed to distinguish from prev collections
                if self.is_search_auto:
                    collection.set_bool_prop('autoindexed', True)

                user.mark_updated()

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
        @self.api(query=['user', 'include_recordings', 'include_lists', 'include_pages'],
                  resp='collections')
        def get_collections():
            user = self.get_user(api=True, redir_check=False)

            kwargs = {'include_recordings': get_bool(request.query.get('include_recordings')),
                      'include_lists': get_bool(request.query.get('include_lists')),
                      'include_pages': get_bool(request.query.get('include_pages')),
                     }

            collections = user.get_collections()

            return {'collections': [coll.serialize(**kwargs) for coll in collections]}

        @self.app.get('/api/v1/collection/<coll_name>')
        @self.api(query=['user'],
                  resp='collection')
        def get_collection(coll_name):
            user = self.get_user(api=True, redir_check=False)

            return self.get_collection_info(coll_name, user=user)

        @self.app.delete('/api/v1/collection/<coll_name>')
        @self.api(query=['user'],
                  resp='deleted')
        def delete_collection(coll_name):
            user, collection = self.load_user_coll(coll_name=coll_name)

            errs = user.remove_collection(collection, delete=True)
            if errs.get('error'):
                return self._raise_error(400, errs['error'])
            else:
                return {'deleted_id': coll_name}

        @self.app.put('/api/v1/collection/<coll_name>/warc')
        def add_external_warc(coll_name):
            if not self.allow_external:
                self._raise_error(403, 'external_not_allowed')

            user, collection = self.load_user_coll(coll_name=coll_name)

            self.access.assert_can_admin_coll(collection)

            if not collection.is_external():
                self._raise_error(400, 'external_only')

            num_added = collection.add_warcs(request.json.get('warcs', {}))

            return {'success': num_added}

        @self.app.put('/api/v1/collection/<coll_name>/cdx')
        def add_external_cdxj(coll_name):
            if not self.allow_external:
                self._raise_error(403, 'external_not_allowed')

            user, collection = self.load_user_coll(coll_name=coll_name)

            self.access.assert_can_admin_coll(collection)

            if not collection.is_external():
                self._raise_error(400, 'external_only')

            num_added = collection.add_cdxj(request.body.read())

            return {'success': num_added}

        @self.app.post('/api/v1/collection/<coll_name>')
        @self.api(query=['user'],
                  req=['title', 'desc', 'public', 'public_index'],
                  resp='collection')
        def update_collection(coll_name):
            user, collection = self.load_user_coll(coll_name=coll_name)

            self.access.assert_can_admin_coll(collection)

            data = request.json or {}

            if 'title' in data:
                new_coll_title = data['title']
                new_coll_name = self.sanitize_title(new_coll_title)

                if not new_coll_name:
                    self._raise_error(400, 'invalid_coll_name')

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

            collection.mark_updated()
            return {'collection': collection.serialize()}

        @self.app.get('/api/v1/collection/<coll_name>/page_bookmarks')
        @self.api(query=['user'],
                  resp='bookmarks')
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

        @self.app.get('/api/v1/url_search')
        def do_url_search():
            user, collection = self.load_user_coll()
            results = []

            search = request.query.getunicode('search', '').lower()
            url_query = request.query.getunicode('url', '').lower()
            has_query = search or url_query
            ts_from = request.query.getunicode('from')
            ts_to = request.query.getunicode('to')
            date_filter = ts_from and ts_to

            if date_filter:
                try:
                    ts_from = int(ts_from)
                    ts_to = int(ts_to)
                except ValueError:
                    date_filter = False

            session = request.query.getunicode('session')

            # remove trailing comma,
            mimes = request.query.getunicode('mime', '').rstrip(',')
            mimes = mimes.split(',') if mimes else []

            # search pages or default to page search if no mime supplied
            if 'text/html' in mimes or len(mimes) == 0:
                try:
                    mimes.remove('text/html')
                except ValueError:
                    pass

                # shortcut empty search
                if not has_query and not date_filter and not session:
                    results = collection.list_pages()
                else:
                    for page in collection.list_pages():
                        # check for legacy hidden flag
                        if page.get('hidden', False):
                            continue

                        if date_filter:
                            try:
                                # trim seconds
                                ts = int(page['timestamp'][:12])
                            except ValueError:
                                continue
                            if ts < ts_from or ts > ts_to:
                                continue

                        if session and page['rec'] != session:
                            continue

                        if search and search not in page.get('title', '').lower():
                            continue

                        if url_query and url_query not in page['url'].lower():
                            continue

                        results.append(page)

            # search non-page cdx
            if len(mimes):
                for line, _ in collection.get_cdxj_iter():
                    cdxj = CDXObject(line.encode('utf-8'))

                    if date_filter:
                        try:
                            # trim seconds
                            ts = int(cdxj['timestamp'][:12])
                        except ValueError:
                            continue
                        if ts < ts_from or ts > ts_to:
                            continue

                    if search and search not in cdxj['url'].lower():
                        continue

                    if url_query and url_query not in cdxj['url'].lower():
                        continue

                    if mimes and not any(cdxj['mime'].startswith(mime) for mime in mimes):
                        continue

                    results.append({'url': cdxj['url'],
                                    'timestamp': cdxj['timestamp'],
                                    'mime': cdxj['mime']})

            return {'results': results}

        @self.app.get('/api/v1/text_search')
        def do_text_search():
            if not self.solr_mgr:
                self._raise_error(400, 'not_supported')

            user, collection = self.load_user_coll()

            return self.solr_mgr.query_solr(collection.my_id, request.query)

        # DAT
        @self.app.post('/api/v1/collection/<coll_name>/dat/share')
        def dat_do_share(coll_name):
            user, collection = self.load_user_coll(coll_name=coll_name)

            # BETA only
            self.require_admin_beta_access(collection)

            try:
                data = request.json or {}
                result = DatShare.dat_share.share(collection, data.get('always_update', False))
            except Exception as e:
                result = {'error': 'api_error', 'details': str(e)}

            if 'error' in result:
                self._raise_error(400, result['error'])

            return result

        @self.app.post('/api/v1/collection/<coll_name>/dat/unshare')
        def dat_do_unshare(coll_name):
            user, collection = self.load_user_coll(coll_name=coll_name)

            # BETA only
            self.require_admin_beta_access(collection)

            try:
                result = DatShare.dat_share.unshare(collection)
            except Exception as e:
                result = {'error': 'api_error', 'details': str(e)}

            if 'error' in result:
                self._raise_error(400, result['error'])

            return result

        @self.app.post('/api/v1/collection/<coll_name>/commit')
        def commit_file(coll_name):
            user, collection = self.load_user_coll(coll_name=coll_name)

            self.access.assert_can_admin_coll(collection)

            data = request.json or {}

            res = collection.commit_all(data.get('commit_id'))
            if not res:
                return {'success': True}
            else:
                return {'commit_id': res}


        @self.app.post('/api/v1/collection/<coll_name>/generate_derivs')
        def generate_derivs(coll_name):
            user, collection = self.load_user_coll(coll_name=coll_name)

            self.access.assert_can_admin_coll(collection)

            if not self.is_search_auto:
                self._raise_error(400, 'not_supported')

            title = 'Derivates Regenerated on ' + datetime.datetime.now().isoformat()
            derivs_recording = collection.create_recording(title=title,
                                                           rec_type='derivs')

            res = collection.requeue_pages_for_derivs(derivs_recording.my_id, get_bool(request.query.get('include_existing')))

            if res > 0:
                collection.set_bool_prop('autoindexed', True)

            return {'queued': res}

        # LEGACY ENDPOINTS (to remove)
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

        wr_api_spec.set_curr_tag(None)

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

        if self.is_search_auto:
            # see if there are results in solr
            if (user.curr_role in ['admin', 'beta-archivist'] and
                self.solr_mgr.query_solr(collection.my_id, {})['total'] == 0):
                print('sycing solr derivs...')
                collection.sync_solr_derivatives(do_async=True)
            else:
                # sync cdxj to redis in lieu of playback
                print('syncing cdx...')
                collection.sync_coll_index(exists=False, do_async=True)

        result = {'collection': collection.serialize(include_rec_pages=include_pages,
                                                     include_lists=True,
                                                     include_recordings=True,
                                                     include_pages=True,
                                                     check_slug=coll_name)}

        result['user'] = user.my_id
        result['size_remaining'] = user.get_size_remaining()

        return result
