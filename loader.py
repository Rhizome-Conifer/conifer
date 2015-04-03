from pywb.webapp.pywb_init import DirectoryCollsLoader
import os

class switch_dir(object):
    def __init__(self, newdir):
        self.origcwd = os.getcwd()
        self.newdir = newdir

    def __enter__(self):
        os.chdir(self.newdir)
        return self

    def __exit__(self, *args):
        os.chdir(self.origcwd)


class AccountUserLoader(object):
    def __init__(self, config, static_routes):
        self.config = config
        self.static_routes = static_routes
        self.colls = {}

    def __call__(self):
        for usr in os.listdir('users'):
            full = os.path.join('users', usr)
            with switch_dir(full):
                r = DirectoryCollsLoader(self.config, self.static_routes)
                r = r()

                colls = {}
                for n, v in r.iteritems():
                    name = usr + '/' + n
                    colls[name + '/record'] = self.add_live_web_coll()
                    colls[name] = v

                self.colls.update(colls)

        return self.colls

    def add_live_web_coll(self):
        live = {'index_paths': '$liveweb',
                'cookie_scope': 'default'}

        return live
