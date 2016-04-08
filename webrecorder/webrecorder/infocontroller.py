from bottle import request, response, HTTPError
from webrecorder.basecontroller import BaseController

from webrecorder.webreccork import ValidationException


# ============================================================================
class InfoController(BaseController):
    def init_routes(self):

        # Anonymous Info Pages
        @self.app.get(['/anonymous', '/anonymous/'])
        def anon_coll_info():
            user = self.get_session().anon_user

            return self.get_info(user, 'anonymous')

        @self.app.get(['/anonymous/<rec>', '/anonymous/<rec>/'])
        def anon_rec_info(rec):
            user = self.get_session().anon_user

            return self.get_info(user, 'anonymous', rec)

        # User Info
        @self.app.get(['/<user>', '/<user>/'])
        @self.jinja2_view('user.html')
        def user_info(user):
            return {'user': user,
                    'user_info': self.manager.get_user_info(user),
                    'colls': self.manager.get_collections(user),
                   }

        # User Account Settings
        @self.app.get('/<user>/_settings')
        @self.jinja2_view('account.html')
        def account_settings(user):
            return {'user': user,
                    'user_info': self.manager.get_user_info(user),
                    'num_coll': self.manager.num_collections(user),
                   }

        # Create Collection
        @self.app.get('/_create')
        @self.jinja2_view('create.html')
        def create_coll_view():
            return {}


        @self.app.post('/_create')
        def create_coll_post():
            self.manager.cork.require(role='archivist', fail_redirect='/')

            coll = self.post_get('collection')
            title = self.post_get('title', coll)
            is_public = self.post_get('public', 'private') == 'public'

            user = self.manager.get_curr_user()

            try:
                #self.manager.add_collection(user, coll_name, title, access)
                self.manager.create_collection(user, coll, title,
                                               desc='', public=is_public)
                self.flash_message('Created collection <b>{0}</b>!'.format(coll), 'success')
                redir_to = '/{user}/{coll}'.format(user=user, coll=coll)
            except ValidationException as ve:
                self.flash_message(str(ve))
                redir_to = '/_create'

            self.redirect(redir_to)


        @self.app.get(['/<user>/<coll>', '/<user>/<coll>/'])
        def coll_info(user, coll):

            return self.get_info(user, coll)

        @self.app.get(['/<user>/<coll>/<rec>', '/<user>/<coll>/<rec>/'])
        def rec_info(user, coll, rec):

            return self.get_info(user, coll, rec)

    def get_info(self, user, coll, rec=None):
        result = {}
        result['size_remaining'] = self.manager.get_size_remaining(user)
        result['collection'] = self.manager.get_collection(user, coll)
        if rec:
            result['recording'] = self.manager.get_recording(user, coll, rec)
            result['pages'] = self.manager.list_pages(user, coll, rec)

        return result


