import os
import re
import glob

from pywb.warcserver.index.indexsource import MementoIndexSource, RemoteIndexSource
from pywb.warcserver.index.indexsource import WBMementoIndexSource
from pywb.utils.loaders import load_yaml_config


# ============================================================================
class WAMLoader(object):
    STRIP_SCHEME = re.compile(r'https?://')

    def __init__(self, index_file=None, base_dir=None,
                 memento_cls=None, remote_cls=None, wb_memento_cls=None):
        self.index_file = index_file or './webarchives.yaml'
        self.base_dir = base_dir or './webrecorder/config/webarchives'
        self.all_archives = {}
        self.replay_info = {}

        self.memento_cls = memento_cls or MementoIndexSource
        self.remote_cls = remote_cls or RemoteIndexSource
        self.wb_memento_cls = wb_memento_cls or WBMementoIndexSource

        try:
            self.load_all()
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

    def load_all(self):
        for filename in self.load_from_index(self.base_dir, self.index_file):
            data = load_yaml_config(filename)
            res = self.process(data)

    def load_from_index(self, base_dir, index_file):
        config = load_yaml_config(os.path.join(base_dir, index_file))
        for pattern in config['webarchive_index']:
            full = os.path.join(base_dir, pattern)
            return glob.glob(full)

    def process(self, data):
        webarchives = data['webarchives']
        for pk, webarchive in webarchives.items():
            if 'apis' not in webarchive:
                continue

            apis = webarchive['apis']
            if 'wayback' not in apis:
                continue

            replay = apis['wayback'].get('replay', {})
            replay_url = replay.get('raw')

            if not replay_url:
                continue

            archive_name = webarchive.get('name')
            archive_about = webarchive.get('about')
            replay_prefix = self.STRIP_SCHEME.sub('', replay_url.split('{',1)[0])
            collections = webarchive.get('collections')

            self.replay_info[pk] = {'replay_url': replay_url,
                                    'parse_collection': collections is not None,
                                    'replay_prefix': replay_prefix,
                                    'name': archive_name,
                                    'about': archive_about}

            if collections and isinstance(collections, list):
                for coll in collections:
                    coll_name = pk + ':' + coll['id']
                    self.add_index(replay_url, apis, coll_name, coll['id'])

            else:
                coll = ''
                if collections:
                    if 'cdx' not in apis:
                        # regex collections only supported with cdx for now
                        continue

                    coll = '{src_coll}'

                self.add_index(replay_url, apis, pk, collection=coll)

    def add_index(self, replay, apis, pk, collection=''):
        replay = replay.replace('{collection}', collection)
        index = None

        if 'memento' in apis:
            timegate = apis['memento']['timegate'].replace('{collection}', collection) + '{url}'
            timemap = apis['memento']['timemap'].replace('{collection}', collection) + '{url}'
            index = self.memento_cls(timegate, timemap, replay)
        elif 'cdx' in apis:
            query = apis['cdx']['query'].replace('{collection}', collection)
            index = self.remote_cls(query, replay)

        else:
            index = self.wb_memento_cls('', '', replay)

        if index:
            self.all_archives[pk] = index


# ============================================================================
if __name__ == "__main__":
    WAMImporter('webarchives.yaml', '../config/webarchives')

