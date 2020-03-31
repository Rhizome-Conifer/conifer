import json
import redis
import os
import logging
import requests

logger = logging.getLogger('wr.io')

from webrecorder.models import User, Collection
from webrecorder.models.base import BaseAccess
from collections import defaultdict


# =============================================================================
BROWSER = 'chrome:76'

SEARCH_CRAWL_DEF = {
    'name': 'search-auto',
    'crawl_type': 'single-page',
    'num_browsers': 1,
    'num_tabs': 1,

    'coll': 'replay',
    'mode': 'replay',
    'screenshot_coll': 'replay',
    'text_coll': 'replay',

    'behavior_max_time': 300,
    'browser': BROWSER,
    'cache': 'default',
    'headless': True
}


# =============================================================================
class SearchAutomation(object):
    def __init__(self, config):
        self.redis = redis.StrictRedis.from_url(os.environ['REDIS_BASE_URL'],
                                                decode_responses=True)

        self.browsertrix_url = config['browsertrix_url']

    def __call__(self):
        print('Running SearchAuto')
        self.process_new_pages()

    def process_new_pages(self):
        crawl_groups = {}

        while True:
            data = self.redis.rpop(Collection.NEW_PAGES_Q)
            if not data:
                break

            page_data = json.loads(data)

            rec = page_data['rec']

            if rec not in crawl_groups:
                crawl_groups[rec] = {
                    'user': page_data['user'],
                    'coll': page_data['coll'],
                    'coll_name': page_data['coll_name'],
                    'pages': []
                }

            crawl_groups[rec]['pages'].append({
                'pid': page_data['pid'],
                'url': page_data['url'],
                'timestamp': page_data['timestamp'],
                'title': page_data.get('title'),
            })

        for rec, data in crawl_groups.items():
            crawl_def = SEARCH_CRAWL_DEF.copy()
            crawl_def['coll'] = crawl_def['screenshot_coll'] = crawl_def['text_coll'] = data['coll']
            crawl_def['user_params'] = {
                'user': data['user'],
                'coll': data['coll'],
                'coll_name': data['coll_name'],
                'rec': rec,
                'type': 'replay-coll',
                # updated later
                'request_ts': '',
                'browser': BROWSER
            }
            crawl_def['name'] = 'text-' + data['user'] + '-' + data['coll']
            crawl_def['seed_urls'] = data['pages']

            print(crawl_def)

            r = requests.post(self.browsertrix_url, json=crawl_def)
            print(r.text)


# =============================================================================
if __name__ == "__main__":
    from webrecorder.rec.worker import Worker
    Worker(SearchAutomation).run()

