from bottle import request, response, HTTPError
from webrecorder.basecontroller import BaseController


# ============================================================================
class InfoController(BaseController):
    def init_routes(self):
        @self.app.get(['/anonymous', '/anonymous/'])
        def anon_coll_info():
            user = self.get_session().anon_user

            return self.get_info(user, 'anonymous')

        @self.app.get(['/anonymous/<rec>', '/anonymous/<rec>/'])
        def anon_rec_info(rec):
            user = self.get_session().anon_user

            return self.get_info(user, 'anonymous', rec)

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


