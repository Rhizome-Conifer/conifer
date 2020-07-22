import base64
import hashlib
import json
import os
import re

import requests
from warcio.timeutils import timestamp_now, timestamp_to_iso_date


# =============================================================================
class SolrManager:
    def __init__(self, config):
        self.escape_re = re.compile(r'(?<!\\)(?P<char>[&|+\-!(){}[\]^"~*?:])')
        self.solr_api = 'http://solr:8983/solr/conifer/update/json/docs?commit=true'
        self.solr_update_api = 'http://solr:8983/solr/conifer/update?commit=true'
        self.solr_select_api = 'http://solr:8983/solr/conifer/select'

        self.page_query = (
            '?q=title_t:* '
            'AND timestamp_s:[{f} TO {t}] '
            'AND mime_s:{m} '
            'AND rec_s:{s} '
            'AND url_s:*{u}*'
            '&fq=coll_s:{coll}'
            '&fl=title_t,url_s,timestamp_s,has_screenshot_b,id,rec_s'
            '&rows={rows}'
            '&start={start}'
            '&sort=timestamp_s+{sort}'
        )
        self.text_query = (
            '?q={q}'
            '&fq={fq}'
            '&fl=id,title_t,url_s,timestamp_s,has_screenshot_b,id,rec_s'
            '&hl=true'
            '&hl.fl=content_t,title_t,url_s'
            '&hl.snippets=3'
            '&rows={rows}'
            '&start={start}'
        )

    def _escape(self, query):
        if not query:
            return query
        return self.escape_re.sub(r'\\\g<char>', query)

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

    def prepare_doc(self, params, text=None):
        # text already parsed
        title = params.get('title') or params.get('url')

        url = params.get('url')

        mime_s = params.get('mime', 'text/html')

        timestamp_s = params.get('timestamp') or timestamp_now()
        timestamp_dt = timestamp_to_iso_date(timestamp_s)

        title = title or url

        #if self.update_if_dupe(digest, coll, url, timestamp_ss, timestamp_dts):
        #    return

        data = {
            'user_s': params.get('user'),
            'coll_s': params.get('coll'),
            'rec_s': params.get('rec'),
            'title_t': title,
            'url_s': url,
            'timestamp_s': timestamp_s,
            'timestamp_dt': timestamp_dt,
            'mime_s': mime_s,
            'ttl_s': '+30MINUTES'
        }

        if text is not None:
            content = text.decode('utf-8')

            has_screenshot_b = params.get('hasScreenshot') == '1'

            data.update({
                'id': params.get('pid'),
                'content_t': content,
                'digest_s': self.get_digest(content),
                'has_screenshot_b': has_screenshot_b,
            })

        return data

    def batch_ingest(self, data):
        """ Index a batch of documents
            data -- json array of documents to ingest
        """
        requests.post(self.solr_update_api, json=data)

    def ingest(self, *args, **kwargs):
        """Index a single doc into solr"""
        requests.post(self.solr_api, json=self.prepare_doc(*args, **kwargs))

    def get_digest(self, text):
        m = hashlib.sha1()
        m.update(text.encode('utf-8'))
        return 'sha1:' + base64.b32encode(m.digest()).decode('utf-8')

    def query_solr(self, coll, params):
        search = params.get('search')

        start = int(params.get('start', 0))

        rows = int(params.get('limit', 5000))

        sort = params.get('sort', 'asc')

        ts_from = params.get('from', '*')
        ts_to = params.get('to', '*')
        session = params.get('session', '*')
        mime = params.get('mime', '*').strip(',')
        url = self._escape(params.get('url')) or '*'

        if ',' in mime:
            mime = '({})'.format(mime.replace(',', ' OR '))

        if not search:
            qurl = self.solr_select_api + self.page_query.format(
                coll=coll, start=start, rows=rows, sort=sort,
                f=ts_from, t=ts_to, s=session, m=mime, u=url
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
                        'rec': doc.get('rec_s'),
                        'url': doc.get('url_s'),
                        'timestamp': doc.get('timestamp_s'),
                        'id': doc.get('id'),
                        'has_screenshot': doc.get('has_screenshot_b'),
                    }
                    for doc in docs
                ],
            }

        else:
            query = (
                '(content_t:"{q}" OR title_t:"{q}") '
                'AND timestamp_s:[{f} TO {t}] '
                'AND mime_s:{m} '
                'AND rec_s:{s} '
                'AND url_s:*{u}*'
            ).format(
                q=self._escape(search), coll=coll, f=ts_from, t=ts_to,
                s=session, m=mime,u=url)

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
                        'rec': doc.get('rec_s'),
                        'url': doc.get('url_s'),
                        'timestamp': doc.get('timestamp_s'),
                        'id': doc.get('id'),
                        'has_screenshot': doc.get('has_screenshot_b'),
                        'matched': hl.get(doc.get('id'))
                        #'matched': hl.get(doc.get('id'), {}).get('content_t'),
                    }
                    for doc in docs
                ],
            }
