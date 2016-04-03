from recorder.recorderapp import RecorderApp
from recorder.redisindexer import WritableRedisIndexer

from recorder.warcwriter import MultiFileWARCWriter
from recorder.filters import SkipDupePolicy

import redis
import time
import json
import glob

from webagg.utils import res_template

from bottle import Bottle, request
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

        self.rec_info_key_templ = config['r_info_key_templ']
        self.coll_info_key_templ = config['c_info_key_templ']
        self.user_info_key_templ = config['u_info_key_templ']
        self.size_keys = [self.rec_info_key_templ,
                          self.coll_info_key_templ,
                          self.user_info_key_templ]

        self.warc_key_templ = config['warc_key_templ']

        self.warc_rec_prefix = config['warc_name_prefix']
        self.warc_name_templ = config['warc_name_templ']

        self.name = config['recorder_name']

        self.del_r_templ = config['del_r_templ']
        self.del_c_templ = config['del_c_templ']
        self.del_u_templ = config['del_u_templ']

        self.redis_base_url = os.environ['REDIS_BASE_URL']
        self.redis = redis.StrictRedis.from_url(self.redis_base_url)

        self.app = Bottle()
        self.recorder = self.init_recorder()

        self.app.mount('/record', self.recorder)

        gevent.spawn(self.delete_listen_loop)

    def init_recorder(self):
        self.dedup_index = WebRecRedisIndexer(
                name=self.name,
                redis=self.redis,

                cdx_key_template=self.cdxj_key_templ,
                file_key_template=self.warc_key_templ,
                rel_path_template=self.warc_path_templ,

                dupe_policy=SkipDupePolicy(),

                size_keys=self.size_keys,
                rec_info_key_templ=self.rec_info_key_templ
        )


        writer = MultiFileWARCWriter(dir_template=self.warc_path_templ,
                                     filename_template=self.warc_name_templ,
                                     dedup_index=self.dedup_index)

        recorder_app = RecorderApp(self.upstream_url,
                                   writer,
                                   accept_colls='live')

        return recorder_app

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
        if type == 'rec':
            del_templ = self.del_r_templ
        elif type == 'coll':
            del_templ = self.del_c_templ
        elif type == 'user':
            del_templ = self.del_u_templ
        else:
            print('Unknown delete type ' + str(type))
            return

        key_pattern = del_templ.format(user=user, coll=coll, rec=rec)
        keys_to_del = list(self.redis.scan_iter(match=key_pattern))

        with redis.utils.pipeline(self.redis) as pi:
            for key in keys_to_del:
                pi.delete(key)

        if type == 'rec':
            self._delete_rec_warc_key(self, user, coll, rec)

    def _delete_rec_warc_key(self, user, coll, rec):  #pragma: no cover
        warc_key = self.warc_key_templ.format(user=user, coll=coll, rec=rec)
        allwarcs = self.redis.hgetall(warc_key)

        warc_rec_prefix = self.warc_rec_prefix.format(user=user, coll=coll, rec=rec)

        with redis.utils.pipeline(self.redis) as pi:
            for n, v in iteritems(allwarcs):
                n = n.decode('utf-8')
                if n.startswith(warc_rec_prefix):
                    pi.hdel(warc_key, n)
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


