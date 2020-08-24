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
    MAX_CRAWL_GROUPS = 50

    def __init__(self, config):
        self.redis = redis.StrictRedis.from_url(os.environ['REDIS_BASE_URL'],
                                                decode_responses=True)

        self.browsertrix_url = config['browsertrix_url']

    def __call__(self):
        print('Running SearchAuto')
        self.process_new_pages()

    def process_new_pages(self):
        crawl_groups = {}

        while len(crawl_groups) < self.MAX_CRAWL_GROUPS:
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

            if page_data.get('derivs_rec'):
                crawl_groups[rec]['derivs_rec'] = page_data.get('derivs_rec')

        for rec, data in crawl_groups.items():
            user = User(my_id=data['user'],
                        redis=self.redis,
                        access=BaseAccess())

            if not user:
                print('Invalid User: ' + user)
                continue

            collection = user.get_collection_by_name(data['coll_name'])

            if not collection:
                print('Invalid Collection: ' + data['coll_name'])
                continue

            recording = collection.get_recording(rec)

            # if a specific derivates recording is provided, use that
            derivs_rec = data.get('derivs_rec')

            # otherwise create derivates recording if none exists
            if not derivs_rec:
                derivs_recording = recording.get_derivs_recording()
                if not derivs_recording:
                    title = 'Derivatives for: Session from ' + recording.to_iso_date(recording['created_at'], no_T=True)
                    derivs_recording = collection.create_recording(title=title,
                                                                   rec_type='derivs')

                    recording.set_derivs_recording(derivs_recording)

                derivs_rec = derivs_recording.my_id

            crawl_def = SEARCH_CRAWL_DEF.copy()
            crawl_def['coll'] = crawl_def['screenshot_coll'] = crawl_def['text_coll'] = data['coll']
            crawl_def['user_params'] = {
                'user': data['user'],
                'coll': data['coll'],
                'coll_name': data['coll_name'],
                'rec': derivs_rec,
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
    Worker(SearchAutomation, 120).run()
