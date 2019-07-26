from bottle import request, static_file, HTTPResponse
from pkg_resources import resource_filename

import os
import json
import sys
import tarfile
import re
import logging
import traceback


# ============================================================================
class BehaviorMgr(object):
    def __init__(self, root, app):
        self.behaviors_root = root
        self.behaviors_data = os.path.join(self.behaviors_root, 'dist')
        self.behaviors_metadata = os.path.join(self.behaviors_data, 'behaviorMetadata.json')
        self.app = app

        self.default_behavior = {}
        self.behaviors = {}

        try:
            self.unpack_behaviors()
            self.load()
            self.init_routes()
        except Exception as e:
            traceback.print_exc()

    def unpack_behaviors(self, filename='behaviors.tar.gz'):
        if os.path.isfile(self.behaviors_metadata):
            return

        os.makedirs(self.behaviors_data, exist_ok=True)

        if getattr(sys, 'frozen', False):
            behaviors_tarfile = os.path.join(sys._MEIPASS, 'webrecorder', 'config', filename)
        else:
            behaviors_tarfile = resource_filename('webrecorder', 'config/' + filename)

        logging.info('Unpacking behaviors {0} -> {1}'.format(behaviors_tarfile, self.behaviors_root))
        tar = tarfile.open(behaviors_tarfile, 'r')
        tar.extractall(self.behaviors_root)
        tar.close()

    def load(self):
        logging.info('Loading behaviors from {0}'.format(self.behaviors_metadata))

        with open(self.behaviors_metadata, 'rt', encoding='utf-8') as fh:
            metadata = fh.read()
            metadata = json.loads(metadata)
            self.default_behavior = metadata['defaultBehavior']
            self.behaviors = {}

            for behavior in metadata['behaviors']:
                rx = re.compile(behavior['match']['regex'])
                self.behaviors[behavior['name']] = (behavior, rx)

    def find_match(self, url):
        if not url:
            return None

        for behavior, rx in self.behaviors.values():
            if rx.match(url):
                return behavior

        return None

    def init_routes(self):
        @self.app.get('/api/v1/behavior/info-list')
        def info_list():
            url = request.query.getunicode('url')
            behavior = self.find_match(url)
            behavior_list = []
            if behavior:
                behavior_list.append(behavior)

            behavior_list.append(self.default_behavior)
            return {'behaviors': behavior_list}

        @self.app.get('/api/v1/behavior/behavior')
        def get_behavior():
            url = request.query.getunicode('url')
            name = request.query.getunicode('name')
            behavior = None
            if name:
                res = self.behaviors.get(name)
                if res:
                    behavior = res[0]
            elif url:
                behavior = self.find_match(url)

            if not behavior:
                behavior = self.default_behavior

            res = static_file(behavior['fileName'], root=self.behaviors_data)
            return res
