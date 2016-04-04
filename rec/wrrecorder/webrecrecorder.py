from recorder.recorderapp import RecorderApp
from recorder.redisindexer import WritableRedisIndexer

from recorder.warcwriter import MultiFileWARCWriter, SimpleTempWARCWriter
from recorder.filters import SkipDupePolicy

import redis
import time
import json
import glob

from webagg.utils import res_template, ParamFormatter, StreamIter, chunk_encode_iter

from bottle import Bottle, request, debug, response
import os
import shutil
from six import iteritems

import gevent


# ============================================================================
class WebRecRecorder(object):
    def __init__(self, config=None):
        self.upstream_url = os.environ['WEBAGG_HOST']

        self.record_root_dir = os.environ['RECORD_ROOT']

        self.warc_path_templ = config['file_path_templ']
        self.warc_path_templ = self.record_root_dir + self.warc_path_templ

        self.cdxj_key_templ = config['cdxj_key_templ']

        self.rec_page_key_templ = config['r_page_key_templ']

        self.info_keys = config['info_key_templ']

        self.warc_key_templ = config['warc_key_templ']

        self.warc_rec_prefix = config['warc_name_prefix']
        self.warc_name_templ = config['warc_name_templ']

        self.name = config['recorder_name']

        self.del_templ = config['del_templ']

        self.redis_base_url = os.environ['REDIS_BASE_URL']
        self.redis = redis.StrictRedis.from_url(self.redis_base_url)

        self.app = Bottle()
        self.recorder = self.init_recorder()

        self.app.mount('/record', self.recorder)
        self.app.get('/download', callback=self.download)
        debug(True)

        gevent.spawn(self.delete_listen_loop)

    def init_recorder(self):
        self.dedup_index = WebRecRedisIndexer(
                name=self.name,
                redis=self.redis,

                cdx_key_template=self.cdxj_key_templ,
                file_key_template=self.warc_key_templ,
                rel_path_template=self.warc_path_templ,

                dupe_policy=SkipDupePolicy(),

                size_keys=self.info_keys.values(),
                rec_info_key_templ=self.info_keys['rec'],
        )


        writer = MultiFileWARCWriter(dir_template=self.warc_path_templ,
                                     filename_template=self.warc_name_templ,
                                     dedup_index=self.dedup_index)

        recorder_app = RecorderApp(self.upstream_url,
                                   writer,
                                   accept_colls='live')

        return recorder_app

    def get_pagelist(self, user, coll, rec):
        page_key_pattern = self.rec_page_key_templ.format(user=user, coll=coll, rec=rec)

        pages = []
        for page_key in self.redis.scan_iter(match=page_key_pattern):
            pages.extend(self.redis.smembers(page_key))

        return pages

    def download(self):
        user = request.query.get('user', '')
        coll = request.query.get('coll', '*')
        rec = request.query.get('rec', '*')
        type = request.query.get('type')

        filename = request.query.get('filename', 'rec.warc.gz')

        #if not user:
        #    response.status = 400
        #    return {'error_message': 'No User Provided'}

        templ = self.warc_path_templ + '*.warc.gz'
        warcs = list(glob.glob(templ.format(user=user, coll=coll, rec=rec)))

        metadata = {'pages': self.get_pagelist(user, coll, rec)}

        # warcinfo Record
        info = {'software': 'Webrecorder Platform v2.0',
                'format': 'WARC File Format 1.0',
                'json-metadata': metadata,
               }

        wi_writer = SimpleTempWARCWriter()
        wi_writer.write_record(wi_writer.create_warcinfo_record(filename, **info))
        warcinfo = wi_writer.get_buffer()

        key_templ = self.info_keys.get(type, '')
        key_pattern = key_templ.format(user=user, coll=coll, rec=rec)

        length = len(warcinfo)
        try:
            length += int(self.redis.hget(key_pattern, 'size'))
        except Exception as e:
            print(e)

        def read_all(warcinfo):
            yield warcinfo

            for warc in warcs:
                with open(warc, 'rb') as fh:
                    for chunk in StreamIter(fh):
                        yield chunk

        response.headers['Content-Type'] = 'application/octet-stream'
        response.headers['Content-Length'] = int(length)
        resp = read_all(warcinfo)
        #response.headers['Transfer-Encoding'] = 'chunked'
        #resp = chunk_encode_iter(resp)
        return resp

    def delete_listen_loop(self):
        self.pubsub = self.redis.pubsub()
        self.pubsub.subscribe('delete')

        print('Waiting for delete messages')

        for item in self.pubsub.listen():
            try:
                if item['type'] == 'message' and item['channel'] == b'delete':
                    self.handle_delete(item['data'].decode('utf-8'))
            except:
                import traceback
                traceback.print_exc()

    def handle_delete(self, data):
        data = json.loads(data)

        user = data['user']
        coll = data['coll']
        rec = data['rec']
        type = data['type']

        self.delete_files(type, user, coll, rec)
        self.delete_redis_keys(type, user, coll, rec)

    def delete_files(self, type, user, coll, rec):
        if type not in (('user', 'coll', 'rec')):
            print('Unknown delete type ' + str(type))
            return

        glob_path = self.warc_path_templ.format(user=user, coll=coll, rec=rec)

        for dirname in glob.glob(glob_path):
            self.recorder.writer.close_file(dirname)

        if glob_path.endswith('/'):
            glob_path =  os.path.dirname(glob_path)

        if type == 'rec':
            dir_to_delete = glob_path
        elif type == 'coll':
            dir_to_delete = os.path.dirname(glob_path)
        elif type == 'user':
            dir_to_delete = os.path.dirname(os.path.dirname(glob_path))

        try:
            print('Deleting Files in ' + dir_to_delete)
            shutil.rmtree(dir_to_delete)
        except Exception as e:
            print(e)

    def delete_redis_keys(self, type, user, coll, rec):
        key_templ = self.del_templ.get(type)
        if not key_templ:
            print('Unknown delete type ' + str(type))
            return

        key_pattern = key_templ.format(user=user, coll=coll, rec=rec)
        keys_to_del = list(self.redis.scan_iter(match=key_pattern))

        if type == 'rec':
            self._delete_rec_warc_key(user, coll, rec)
            self._delete_decrease_size(user, coll, rec)

        with redis.utils.pipeline(self.redis) as pi:
            for key in keys_to_del:
                pi.delete(key)

    def _delete_rec_warc_key(self, user, coll, rec):
        warc_key = self.warc_key_templ.format(user=user, coll=coll, rec=rec)
        allwarcs = self.redis.hgetall(warc_key)

        warc_rec_prefix = self.warc_rec_prefix.format(user=user, coll=coll, rec=rec)

        with redis.utils.pipeline(self.redis) as pi:
            for n, v in iteritems(allwarcs):
                n = n.decode('utf-8')
                if n.startswith(warc_rec_prefix):
                    pi.hdel(warc_key, n)

    def _delete_decrease_size(self, user, coll, rec):
        rec_info = self.info_keys['rec'].format(user=user, coll=coll, rec=rec)
        try:
            length = int(self.redis.hget(rec_info, 'size'))
        except:
            print('Error decreasing size')
            return

        with redis.utils.pipeline(self.redis) as pi:
            coll_key = self.info_keys['coll'].format(user=user, coll=coll)
            user_key = self.info_keys['user'].format(user=user)
            pi.hincrby(coll_key, 'size', -length)
            pi.hincrby(user_key, 'size', -length)


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


