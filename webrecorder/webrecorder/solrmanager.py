import base64
import hashlib
import json
import os

import requests
from warcio.timeutils import timestamp_now, timestamp_to_iso_date


# =============================================================================
class SolrManager:
    def __init__(self, config):
        self.solr_api = 'http://solr:8983/solr/webrecorder/update/json/docs?commit=true'
        self.solr_update_api = 'http://solr:8983/solr/webrecorder/update?commit=true'
        self.solr_select_api = 'http://solr:8983/solr/webrecorder/select'

        self.page_query = '?q=title_t:*&fq=coll_s:{coll}&fl=title_t,url_s,timestamp_s,has_screenshot_b&rows={rows}&start={start}&sort=timestamp_s+{sort}'
        self.text_query = '?q={q}&fq={fq}&fl=id,title_t,url_s,timestamp_s,has_screenshot_b&hl=true&hl.fl=content_t&hl.snippets=3&rows={rows}&start={start}'

    def update_if_dupe(self, digest, coll, url, timestamp, timestamp_dt):
        try:
            query = 'digest_s:"{0}" AND coll_s:{1} AND url_s:"{2}"'.format(
                digest, coll, url
            )
            resp = requests.get(self.solr_select_api, params={'q': query, 'fl': 'id'})

            resp = resp.json()
            resp = resp.get('response')
            if not resp:
                return False

            docs = resp.get('docs')
            if not docs:
                return False

            id_ = docs[0].get('id')
            if not id_:
                return False

            add_cmd = {
                'add': {
                    'doc': {
                        'id': id_,
                        'timestamp_ss': {'add': timestamp},
                        'timestamp_dts': {'add': timestamp_dt},
                    }
                }
            }

            resp = requests.post(self.solr_update_api, json=add_cmd)
            return True

        except Exception as e:
            print(e)
            return False

    def ingest(self, text, params):

        # text already parsed
        content = text.decode('utf-8')
        title = params.get('title') or params.get('url')

        url = params.get('url')

        timestamp_s = params.get('timestamp') or timestamp_now()
        timestamp_dt = timestamp_to_iso_date(timestamp_s)
        has_screenshot_b = params.get('hasScreenshot') == '1'

        title = title or url

        digest = self.get_digest(content)

        #if self.update_if_dupe(digest, coll, url, timestamp_ss, timestamp_dts):
        #    return

        data = {
            'user_s': params.get('user'),
            'coll_s': params.get('coll'),
            'rec_s': params.get('rec'),
            'page_s': params.get('pid'),
            'title_t': title,
            'content_t': content,
            'url_s': url,
            'digest_s': digest,
            'timestamp_s': timestamp_s,
            'timestamp_dt': timestamp_dt,
            'has_screenshot_b': has_screenshot_b,
        }

        result = requests.post(self.solr_api, json=data)

    def get_digest(self, text):
        m = hashlib.sha1()
        m.update(text.encode('utf-8'))
        return 'sha1:' + base64.b32encode(m.digest()).decode('utf-8')

    def query_solr(self, coll, params):
        search = params.get('search')

        start = int(params.get('start', 0))

        rows = int(params.get('limit', 10))

        sort = params.get('sort', 'asc')

        if not search:
            qurl = self.solr_select_api + self.page_query.format(
                coll=coll, start=start, rows=rows, sort=sort
            )
            res = requests.get(qurl)

            res = res.json()
            resp = res.get('response', {})
            docs = resp.get('docs')

            return {
                'total': resp.get('numFound'),
                'results': [
                    {
                        'title': doc.get('title_t'),
                        'url': doc.get('url_s'),
                        'timestamp': doc.get('timestamp_s'),
                        'page_id': doc.get('page_s'),
                        'has_screenshot': doc.get('has_screenshot_b'),
                    }
                    for doc in docs
                ],
            }

        else:
            query = 'content_t:"{q}" OR title_t:"{q}" OR url_s:"*{q}*"'.format(
                q=search, coll=coll
            )
            res = requests.get(
                self.solr_select_api
                + self.text_query.format(
                    q=query, start=start, rows=rows, fq='coll_s:' + coll
                )
            )

            res = res.json()
            resp = res.get('response', {})
            docs = resp.get('docs')
            hl = res.get('highlighting', {})

            return {
                'total': resp.get('numFound'),
                'results': [
                    {
                        'title': doc.get('title_t'),
                        'url': doc.get('url_s'),
                        'timestamp': doc.get('timestamp_s'),
                        'page_id': doc.get('page_s'),
                        'has_screenshot': doc.get('has_screenshot_b'),
                        'matched': hl.get(doc.get('id'), {}).get('content_t'),
                    }
                    for doc in docs
                ],
            }

