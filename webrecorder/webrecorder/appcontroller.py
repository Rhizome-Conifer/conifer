from webrecorder.basecontroller import BaseController
from webrecorder.models.importer import ImportStatusChecker


# ============================================================================
class AppController(BaseController):
    def __init__(self, *args, **kwargs):
        super(AppController, self).__init__(*args, **kwargs)
        config = kwargs['config']

        # Auto Import on Init Id
        self.init_import_id = config.get('init_import_id')
        self.init_import_username = config.get('init_import_user')
        self.init_import_coll_name = config.get('init_import_coll')

    def init_routes(self):
        @self.app.get(['/', '/index.html'])
        @self.jinja2_view('index.html', refresh_cookie=False)
        def home_page():
            self.redir_host()
            resp = {'is_home': '1'}

            if self.init_import_id:
                return self.handle_player_load(resp)

            if not self.access.session_user.is_anon():
                coll_list = self.access.session_user.get_collections()

                resp['collections'] = [coll.serialize() for coll in coll_list]
                resp['coll_title'] = ''
                resp['rec_title'] = ''

            else:
                self.fill_anon_info(resp)

            return resp

        @self.app.get('/_faq')
        @self.jinja2_view('faq.html')
        def faq():
            return {}

        @self.app.get('/_documentation')
        @self.jinja2_view('howtoguide.html')
        def documentation():
            return {}

        @self.app.get('/_policies')
        @self.jinja2_view('policies.html')
        def policies():
            return {}

        # Expiry Message
        @self.app.route('/_expire')
        def expire():
            self.flash_message('Sorry, the anonymous collection has expired due to inactivity')
            self.redirect('/')

    def handle_player_load(self, resp):
        """ Initial warc load for player
        """
        user = self.user_manager.all_users[self.init_import_username]

        status_checker = ImportStatusChecker(self.redis)

        upload_status = status_checker.get_upload_status(user, self.init_import_id)

        # if upload already finished, redirect to known coll
        if not upload_status or upload_status.get('done'):
            if user and self.init_import_coll_name:
                self.redirect('/' + user.name + '/' + self.init_import_coll_name)

        resp['upload_status'] = upload_status or {}
        return resp
