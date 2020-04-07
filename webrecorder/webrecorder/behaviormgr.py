from webrecorder.apiutils import wr_api_spec
from webrecorder.basecontroller import BaseController
from bottle import request, static_file, HTTPResponse, response
import os
import json
import sys
import tarfile
import re
import logging
import requests
import shutil
import traceback


# ============================================================================
class BehaviorMgr(BaseController):
    def __init__(self, *args, **kwargs):
        super(BehaviorMgr, self).__init__(*args, **kwargs)
        self.behaviors_api = os.environ.get('BEHAVIOR_API', 'http://behaviors:3030')
        self.behaviors_root = os.environ.get('BEHAVIORS_DIR')

        self.behaviors_tarfile = os.environ.get('BEHAVIORS_TARFILE')

        self.default_behavior = {}
        self.behaviors = {}

        if self.behaviors_root:
            self.behaviors_data = os.path.join(self.behaviors_root, 'dist')
            self.behaviors_metadata = os.path.join(self.behaviors_data, 'behaviorMetadata.json')

            try:
                self.unpack_behaviors()
                self.load()
                self.init_routes()
            except Exception as e:
                traceback.print_exc()

    def unpack_behaviors(self):
        if not self.behaviors_tarfile:
            logging.info('No Behaviors Tarfile specified, skipping unpack')

        os.makedirs(self.behaviors_data, exist_ok=True)

        current_tarfile = os.path.join(self.behaviors_root, os.path.basename(self.behaviors_tarfile))

        try:
            if os.path.isfile(current_tarfile) and os.path.getmtime(current_tarfile) > os.path.getmtime(self.behaviors_tarfile):
                logging.info('Already have latest behaviors, not unpacking')
                return
        except Exception as e:
            print(e)

        logging.info('Unpacking behaviors {0} -> {1}'.format(self.behaviors_tarfile, self.behaviors_root))
        tar = tarfile.open(self.behaviors_tarfile, 'r')
        tar.extractall(self.behaviors_root)
        tar.close()

        shutil.copyfile(self.behaviors_tarfile, current_tarfile)

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
        wr_api_spec.set_curr_tag('Behaviors')

        @self.app.get('/api/v1/behavior/info-list')
        def info_list():
            # for non-desktop proxy mode, proxy to behaviors server
            if not self.behaviors_root:
                query = dict(request.query)
                res = requests.get(self.behaviors_api + '/info-list', params=query)
                response.content_type = 'application/json; charset=utf-8'
                return res.content

            url = request.query.getunicode('url')
            behavior = self.find_match(url)
            behavior_list = []
            if behavior:
                behavior_list.append(behavior)

            behavior_list.append(self.default_behavior)
            return {'behaviors': behavior_list}

        @self.app.get('/api/v1/behavior/behavior')
        def get_behavior():
            # for non-desktop proxy mode, proxy to behaviors server
            if not self.behaviors_root:
                query = dict(request.query)
                res = requests.get(self.behaviors_api + '/behavior', params=query)
                response.content_type = 'application/json; charset=utf-8'
                return res.content

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

        wr_api_spec.set_curr_tag(None)
