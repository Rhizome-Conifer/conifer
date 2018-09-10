import re
import yaml
import os

from pywb.utils.loaders import load
from contextlib import closing


# ============================================================================
class WAMLoader(object):
    DEFAULT_WA_FILE = 'pkg://webrecorder/config/_webarchives.yaml'

    STRIP_SCHEME = re.compile(r'https?://')

    def __init__(self):
        self.replay_info = {}

        webarchives_path = self.merge_webarchives()

        try:
            self.load_all(webarchives_path)
        except IOError:
            print('No Archives Loaded')

    def find_archive_for_url(self, url):
        schemeless_url = self.STRIP_SCHEME.sub('', url)
        for pk, info in self.replay_info.items():
            if schemeless_url.startswith(info['replay_prefix']):
                orig_url = schemeless_url[len(info['replay_prefix']):]
                if info.get('parse_collection'):
                    coll, orig_url = orig_url.split('/', 1)
                    id_ = pk + ':' + coll
                else:
                    id_ = pk

                return pk, orig_url, id_

    def load_all(self, webarchives_path):
        wa_file = load(webarchives_path)
        with closing(wa_file):
            for doc in yaml.load_all(wa_file):
                webarchives = doc['webarchives']
                for pk, webarchive in webarchives.items():
                    self.load_archive(pk, webarchive)

    def load_archive(self, pk, webarchive):
        if 'apis' not in webarchive:
            return False

        apis = webarchive['apis']
        if 'wayback' not in apis:
            return False

        replay = apis['wayback'].get('replay', {})
        replay_url = replay.get('raw')

        if not replay_url:
            return False

        archive_name = webarchive.get('name')
        archive_about = webarchive.get('about')
        replay_prefix = self.STRIP_SCHEME.sub('', replay_url.split('{',1)[0])
        collections = webarchive.get('collections')

        self.replay_info[pk] = {'replay_url': replay_url,
                                'parse_collection': collections is not None,
                                'replay_prefix': replay_prefix,
                                'name': archive_name,
                                'about': archive_about}

        return True

    @classmethod
    def merge_webarchives(cls, webarchives_file=None):
        webarchives_file = webarchives_file or cls.DEFAULT_WA_FILE
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

        if webarchives_file.startswith('pkg://'):
            webarchives_file = webarchives_file.replace('pkg://webrecorder', root_dir)
            webarchives_file = webarchives_file.replace('/', os.path.sep)

        webarchives_dir = os.path.join(root_dir, 'config', 'webarchives', 'webarchives')
        if not os.path.isdir(webarchives_dir):
            return webarchives_file

        if os.path.isfile(webarchives_file):
            if os.path.getmtime(webarchives_file) > os.path.getmtime(webarchives_dir):
                print('WAM list up-to-date')
                return webarchives_file

        with open(webarchives_file, 'wt') as out:
            for filename in os.listdir(webarchives_dir):
                out.write('---\n')
                with open(os.path.join(webarchives_dir, filename)) as in_:
                    out.write(in_.read())
                    print('Merging ' + filename)
                out.write('\n...\n')

        return webarchives_file

