from gevent import monkey; monkey.patch_all()

from recorder.recorderapp import RecorderApp
from recorder.redisindexer import WritableRedisIndexer

from recorder.warcwriter import MultiFileWARCWriter
from recorder.filters import SkipDupePolicy

from webagg.utils import ParamFormatter

from bottle import Bottle, request
import os
from six import iteritems


# ============================================================================
class WebRecManager(object):
    def __init__(self, config=None):
        config = config or {}
        self.upstream_url = os.environ.get('UPSREAM_HOST', 'http://localhost:8080')

        self.record_root_dir = os.environ.get('RECORD_ROOT', './data/')
        self.warc_path_templ = self.record_root_dir + config.get('file_path_templ', '{user}/{coll}/{rec}/')

        self.cdxj_key_templ = config.get('cdxj_key_templ', '{user}:{coll}:{rec}:cdxj')

        self.warc_rec_prefix = 'rec-{rec}-'
        self.warc_name_templ = 'rec-{rec}-{timestamp}-{hostname}.warc.gz'
        self.warc_key_templ = config.get('warc_key_templ', '{user}:{coll}:warc')

        self.name = 'recorder'

        self.app = Bottle()
        self.recorder = self.create_recorder()

        self.app.route('/delete', callback=self.delete_recording)
        self.app.mount('/record', self.recorder)


    def create_recorder(self):
        redis_base = os.environ.get('REDIS_BASE_URL', 'redis://localhost/1/')

        cdxj_key_url = redis_base + self.cdxj_key_templ

        self.dedup_index = WritableRedisIndexer(cdxj_key_url,
                file_key_template=self.warc_key_templ,
                rel_path_template=self.warc_path_templ,
                name=self.name,
                dupe_policy=SkipDupePolicy())

        recorder_app = RecorderApp(self.upstream_url,
                         MultiFileWARCWriter(dir_template=self.warc_path_templ,
                                             filename_template=self.warc_name_templ,
                                             dedup_index=self.dedup_index),
                           accept_colls='live')

        return recorder_app

    def delete_recording(self):
        params = request.query
        formatter = ParamFormatter(request.query, self.name)
        params['_formatter'] = formatter

        print(formatter.format(self.cdxj_key_templ))
        print(formatter.format(self.warc_path_templ))
        print(formatter.format(self.warc_key_templ))

        self.recorder.writer.close_file(params)
        self._delete_rec_warc_key(formatter, params)

    def _delete_rec_warc_key(self, formatter, params):
        warc_key = formatter.format(self.warc_key_templ)
        allwarcs = self.dedup_index.redis.hgetall(warc_key)

        warc_rec_prefix = formatter.format(self.warc_rec_prefix)

        for n, v in iteritems(allwarcs):
            n = n.decode('utf-8')
            if n.startswith(warc_rec_prefix):
                print(n)
            else:
                print('SKIP ' + n)


wr = WebRecManager()
application = wr.app


