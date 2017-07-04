from pywb.warcserver.index.indexsource import MementoIndexSource
from pywb.warcserver.index.indexsource import RemoteIndexSource
from pywb.warcserver.index.indexsource import WBMementoIndexSource

from webrecorder.load.wamloader import WAMLoader


# ============================================================================
class WAMSourceLoader(WAMLoader):
    def __init__(self, memento_cls=None, remote_cls=None, wb_memento_cls=None):
        self.sources = {}

        self.memento_cls = memento_cls or MementoIndexSource
        self.remote_cls = remote_cls or RemoteIndexSource
        self.wb_memento_cls = wb_memento_cls or WBMementoIndexSource

        super(WAMSourceLoader, self).__init__()

    def load_archive(self, pk, webarchive):
        # if archive was not loaded, don't init source
        if not super(WAMSourceLoader, self).load_archive(pk, webarchive):
            return False

        collections = webarchive.get('collections')
        replay_url = self.replay_info[pk]['replay_url']
        apis = webarchive['apis']

        if collections and isinstance(collections, list):
            for coll in collections:
                coll_name = pk + ':' + coll['id']
                self.add_source(replay_url, apis, coll_name, coll['id'])

        else:
            coll = ''
            if collections:
                if 'cdx' not in apis:
                    # regex collections only supported with cdx for now
                    return

                coll = '{src_coll}'

            self.add_source(replay_url, apis, pk, collection=coll)

        return True

    def add_source(self, replay, apis, pk, collection=''):
        replay = replay.replace('{collection}', collection)
        source = None

        if 'memento' in apis:
            timegate = apis['memento']['timegate'].replace('{collection}', collection) + '{url}'
            timemap = apis['memento']['timemap'].replace('{collection}', collection) + '{url}'
            source = self.memento_cls(timegate, timemap, replay)

        elif 'cdx' in apis:
            query = apis['cdx']['query'].replace('{collection}', collection)
            source = self.remote_cls(query, replay)

        else:
            source = self.wb_memento_cls(replay, '', replay)

        if source:
            self.sources[pk] = source


