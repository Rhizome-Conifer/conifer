import os
import re
import glob

from pywb.warcserver.index.indexsource import MementoIndexSource, RemoteIndexSource
from pywb.warcserver.index.indexsource import WBMementoIndexSource
from pywb.utils.loaders import load_yaml_config


# ============================================================================
class WAMLoader(object):
    def __init__(self, index_file=None, base_dir=None):
        self.index_file = index_file or './webarchives.yaml'
        self.base_dir = base_dir or './webrecorder/config/webarchives'
        self.all_archives = {}
        self.replay_info = {}

        try:
            self.load_all()
        except IOError:
            print('No Archives Loaded')

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
            replay_prefix = re.sub(r'https?://', '', replay_url.split('{',1)[0])
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
            index = MementoIndexSource(timegate, timemap, replay)
        elif 'cdx' in apis:
            query = apis['cdx']['query'].replace('{collection}', collection)
            index = RemoteIndexSource(query, replay)

        else:
            index = WBMementoIndexSource(replay)

        if index:
            self.all_archives[pk] = index


# ============================================================================
if __name__ == "__main__":
    WAMImporter('webarchives.yaml', '../config/webarchives')

