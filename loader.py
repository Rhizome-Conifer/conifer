from pywb.webapp.pywb_init import DirectoryCollsLoader
import os

class AccountUserLoader(object):
    def __init__(self, config, static_routes):
        self.config = config
        self.static_routes = static_routes
        self.colls = {}

    def __call__(self):
        curr = os.getcwd()
        for usr in os.listdir('users'):
            full = os.path.join('users', usr)
            os.chdir(full)

            r = DirectoryCollsLoader(self.config, self.static_routes)
            r = r()

            colls = {}
            for n, v in r.iteritems():
                name = usr + '/' + n
                colls[name + '/record'] = self.add_live_web_coll()
                colls[name] = v

            self.colls.update(colls)
            os.chdir(curr)

        return self.colls

    def add_live_web_coll(self):
        live = {'index_paths': '$liveweb',
                'cookie_scope': 'default'}

        return live
