#from gevent import monkey; monkey.patch_all()

from recorder.recorderapp import RecorderApp
from recorder.redisindexer import WritableRedisIndexer

from recorder.warcwriter import MultiFileWARCWriter
from recorder.filters import SkipDupePolicy

import redis
import time

from webagg.utils import ParamFormatter, res_template

from bottle import Bottle, request
import os
from six import iteritems


# ============================================================================
class WebRecRecorder(object):
    def __init__(self, config=None):
        config = config or {}
        self.upstream_url = os.environ.get('UPSREAM_HOST', 'http://localhost:8080')

        self.record_root_dir = os.environ.get('RECORD_ROOT', './data/')
        self.warc_path_templ = self.record_root_dir + config.get('file_path_templ', '{user}/{coll}/{rec}/')

        self.cdxj_key_templ = config.get('cdxj_key_templ', '{user}:{coll}:{rec}:cdxj')

        self.rec_info_key_templ = config.get('r_info_key_templ', 'r:{user}:{coll}:{rec}:info')
        self.coll_info_key_templ = config.get('c_info_key_templ', 'c:{user}:{coll}')
        self.user_info_key_templ = config.get('u_info_key_templ', 'u:{user}')
        self.size_keys = [self.rec_info_key_templ,
                          self.coll_info_key_templ,
                          self.user_info_key_templ]

        self.warc_rec_prefix = 'rec-{rec}-'
        self.warc_name_templ = 'rec-{rec}-{timestamp}-{hostname}.warc.gz'
        self.warc_key_templ = config.get('warc_key_templ', '{user}:{coll}:warc')

        self.name = 'recorder'

        self.redis_base_url = os.environ.get('REDIS_BASE_URL', 'redis://localhost/1')
        self.redis = redis.StrictRedis.from_url(self.redis_base_url)

        self.app = Bottle()
        self.recorder = self.init_recorder()

        self.app.route('/delete', callback=self.delete_recording)
        self.app.mount('/record', self.recorder)


    def init_recorder(self):
        self.dedup_index = WebRecRedisIndexer(
                name=self.name,
                redis=self.redis,

                cdx_key_template=self.cdxj_key_templ,
                file_key_template=self.warc_key_templ,
                rel_path_template=self.warc_path_templ,

                dupe_policy=SkipDupePolicy(),

                size_keys=self.size_keys,
                rec_info_key_templ=self.rec_info_key_templ)

        recorder_app = RecorderApp(self.upstream_url,
                         MultiFileWARCWriter(dir_template=self.warc_path_templ,
                                             filename_template=self.warc_name_templ,
                                             dedup_index=self.dedup_index),
                           accept_colls='live')

        return recorder_app

    def delete_recording(self):  #pragma: no cover
        params = request.query
        formatter = ParamFormatter(request.query, self.name)
        params['_formatter'] = formatter

        print(formatter.format(self.cdxj_key_templ))
        print(formatter.format(self.warc_path_templ))
        print(formatter.format(self.warc_key_templ))

        self.recorder.writer.close_file(params)
        self._delete_rec_warc_key(formatter, params)

    def _delete_rec_warc_key(self, formatter, params):  #pragma: no cover
        warc_key = formatter.format(self.warc_key_templ)
        allwarcs = self.dedup_index.redis.hgetall(warc_key)

        warc_rec_prefix = formatter.format(self.warc_rec_prefix)

        for n, v in iteritems(allwarcs):
            n = n.decode('utf-8')
            if n.startswith(warc_rec_prefix):
                print(n)
            else:
                print('SKIP ' + n)


# ============================================================================
class WebRecRedisIndexer(WritableRedisIndexer):
    def __init__(self, *args, **kwargs):
        super(WebRecRedisIndexer, self).__init__(*args, **kwargs)

        self.size_keys = kwargs.get('size_keys', [])
        self.rec_info_key_templ = kwargs.get('rec_info_key_templ')

    def add_urls_to_index(self, stream, params, filename, length):
        cdx_list = (super(WebRecRedisIndexer, self).
                      add_urls_to_index(stream, params, filename, length))

        with redis.utils.pipeline(self.redis) as pi:
            for key_templ in self.size_keys:
                key = res_template(key_templ, params)
                pi.hincrby(key, 'size', length)

                if key_templ == self.rec_info_key_templ and cdx_list:
                    pi.hset(key, 'updated_at', str(int(time.time())))

        return cdx_list


# ============================================================================
if __name__ == "__main__":  #pragma: no cover
    wr = WebRecRecorder()
    application = wr.app

