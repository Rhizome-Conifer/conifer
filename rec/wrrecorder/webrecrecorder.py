from recorder.recorderapp import RecorderApp
from recorder.redisindexer import WritableRedisIndexer

from recorder.warcwriter import MultiFileWARCWriter, SimpleTempWARCWriter
from recorder.filters import SkipDupePolicy
from recorder.filters import ExcludeSpecificHeaders

from pywb.utils.loaders import BlockLoader

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
    def __init__(self, config=None, storage_committer=None):
        self.storage_committer = storage_committer

        self.upstream_url = os.environ['WEBAGG_HOST']

        self.record_root_dir = os.environ['RECORD_ROOT']

        self.warc_path_templ = config['file_path_templ']
        self.warc_path_templ = self.record_root_dir + self.warc_path_templ

        self.cdxj_key_templ = config['cdxj_key_templ']

        self.rec_page_key_templ = config['page_key_templ']

        self.info_keys = config['info_key_templ']

        self.warc_key_templ = config['warc_key_templ']

        self.warc_rec_prefix = config['warc_name_prefix']
        self.warc_name_templ = config['warc_name_templ']

        self.full_warc_prefix = config['full_warc_prefix']

        self.name = config['recorder_name']

        self.del_templ = config['del_templ']

        self.skip_key_templ = config['skip_key_templ']

        self.redis_base_url = os.environ['REDIS_BASE_URL']
        self.redis = redis.StrictRedis.from_url(self.redis_base_url)

        self.app = Bottle()
        self.recorder = self.init_recorder()

        self.app.mount('/record', self.recorder)
        self.app.get('/download', callback=self.download)
        self.app.delete('/delete', callback=self.delete)
        self.app.get('/rename', callback=self.rename)

        debug(True)

        gevent.spawn(self.delete_listen_loop)

    def init_recorder(self):
        self.dedup_index = WebRecRedisIndexer(
            name=self.name,
            redis=self.redis,

            cdx_key_template=self.cdxj_key_templ,
            file_key_template=self.warc_key_templ,
            rel_path_template=self.warc_path_templ,

            full_warc_prefix=self.full_warc_prefix,

            dupe_policy=SkipDupePolicy(),

            size_keys=self.info_keys.values(),
            rec_info_key_templ=self.info_keys['rec'],
        )


        header_filter = ExcludeSpecificHeaders(['Set-Cookie', 'Cookie'])

        writer = SkipCheckingMultiFileWARCWriter(dir_template=self.warc_path_templ,
                                     filename_template=self.warc_name_templ,
                                     dedup_index=self.dedup_index,
                                     redis=self.redis,
                                     skip_key_templ=self.skip_key_templ,
                                     header_filter=header_filter)

        self.writer = writer
        recorder_app = RecorderApp(self.upstream_url,
                                   writer,
                                   accept_colls='live')

        return recorder_app

    def get_pagelist(self, user, coll, rec):
        page_key_pattern = self.rec_page_key_templ.format(user=user, coll=coll, rec=rec)

        pages = []
        for page_key in self.redis.scan_iter(match=page_key_pattern):
            for page in self.redis.hvals(page_key):
                pages.append(json.loads(page.decode('utf-8')))

        return pages

    def get_profile(self, scheme, profile):
        res = self.redis.hgetall('st:' + profile)
        if not res:
            return dict()

        return dict((n.decode('utf-8'), v.decode('utf-8')) for n, v in res.items())

    def _close_active_writers(self, user, coll, rec):
        # close active writers
        glob_path = self.warc_path_templ.format(user=user, coll=coll, rec=rec)

        count = 0

        for dirname in glob.glob(glob_path):
            self.recorder.writer.close_dir(dirname)
            count += 1

        return glob_path, count

    def _iter_all_warcs(self, user, coll, rec=''):
        warc_key = self.warc_key_templ.format(user=user, coll=coll)
        allwarcs = self.redis.hgetall(warc_key)

        if rec and rec != '*':
            rec_prefix = self.warc_rec_prefix.format(user=user, coll=coll, rec=rec)
        else:
            rec_prefix = ''

        for n, v in iteritems(allwarcs):
            n = n.decode('utf-8')
            if not rec_prefix or n.startswith(rec_prefix):
                yield warc_key, n, v.decode('utf-8')

    def rename(self):
        from_user = request.query.get('from_user', '')
        from_coll = request.query.get('from_coll', '')
        to_user = request.query.get('to_user', '')
        to_coll = request.query.get('to_coll', '')
        to_coll_title = request.query.get('to_coll_title', '')

        if not from_user or not from_coll or not to_user or not to_coll:
            return {'error_message': 'user or coll params missing'}

        if not to_coll_title:
            to_coll_title = to_coll

        src_path, count = self._close_active_writers(from_user, from_coll, '*')

        if not count:
            return {'error_message': 'no local data found'}

        # Move the actual data first
        dest_path = self.warc_path_templ.format(user=to_user, coll=to_coll, rec='*')
        dest_path = dest_path.rstrip('*/')

        src_path = src_path.rstrip('*/')

        try:
            print(src_path + ' => ' + dest_path)
            os.renames(src_path, dest_path)
        except Exception as e:
            return {'error_message': str(e)}

        # Move the redis keys
        match_pattern = ':' + from_user + ':' + from_coll + ':'
        replace_pattern = ':' + to_user + ':' + to_coll + ':'
        moves = {}

        for key in self.redis.scan_iter(match='*' + match_pattern + '*'):
            key = key.decode('utf-8')
            moves[key] = key.replace(match_pattern, replace_pattern)

        with redis.utils.pipeline(self.redis) as pi:
            for from_key, to_key in iteritems(moves):
                pi.renamenx(from_key, to_key)

        # Increment new user size counter
        user_info = self.info_keys['user'].format(user=to_user)
        coll_info = self.info_keys['coll'].format(user=to_user, coll=to_coll)
        size = int(self.redis.hget(coll_info, 'size'))

        # set replace paths
        match_pattern = '/' + from_user + '/' + from_coll
        replace_pattern = '/' + to_user + '/' + to_coll

        with redis.utils.pipeline(self.redis) as pi:
            # increment size
            pi.hincrby(user_info, 'size', size)

            # Fix Id and Title
            pi.hset(coll_info, 'id', to_coll)
            pi.hset(coll_info, 'title', to_coll_title)

            # fix paths
            for key, n, v in self._iter_all_warcs(to_user, to_coll):
                v = v.replace(match_pattern, replace_pattern)
                pi.hset(key, n, v)

        return {'success': to_user + ':' + to_coll}


    def download(self):
        user = request.query.get('user', '')
        coll = request.query.get('coll', '*')
        rec = request.query.get('rec', '*')
        type = request.query.get('type')

        filename = request.query.get('filename', 'rec.warc.gz')

        #if not user:
        #    response.status = 400
        #    return {'error_message': 'No User Provided'}

        metadata = {'pages': self.get_pagelist(user, coll, rec)}

        part_of = coll
        if rec != '*':
            part_of += '/' + rec

        # warcinfo Record
        info = {'software': 'Webrecorder Platform v2.0',
                'format': 'WARC File Format 1.0',
                'json-metadata': json.dumps(metadata),
                'isPartOf': part_of,
                'creator': user,
               }

        title = request.query.get('rec_title')
        if title:
            info['title'] = title

        coll_title = request.query.get('coll_title')
        if coll_title:
            info['isPartOf'] = coll_title

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

        loader = BlockLoader()

        def read_all():
            yield warcinfo

            for key, n, v in self._iter_all_warcs(user, coll, rec):
                fh = loader.load(v)

                for chunk in StreamIter(fh):
                    yield chunk

        response.headers['Content-Type'] = 'application/octet-stream'
        response.headers['Content-Length'] = int(length)
        resp = read_all()
        #response.headers['Transfer-Encoding'] = 'chunked'
        #resp = chunk_encode_iter(resp)
        return resp

    def delete(self):
        user = request.query.get('user', '')
        coll = request.query.get('coll', '*')
        rec = request.query.get('rec', '*')
        type = request.query.get('type')

        if not self.send_delete_local(user, coll, rec, type):
            return {'error_message': 'no local clients'}

        try:
            self.delete_redis_keys(type, user, coll, rec)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {'error_message': str(e)}

        if self.storage_committer:
            storage = self.storage_committer.get_storage(user, coll, rec)
            if storage and not storage.delete(user, coll, rec, type):
                return {'error_message': 'remote delete failed'}

        return {}

    def send_delete_local(self, user, coll, rec, type):
        # delete local
        message = {'type': type,
                   'user': user,
                   'coll': coll,
                   'rec': rec}

        res = self.redis.publish('delete', json.dumps(message))
        return (res > 0)

    def delete_listen_loop(self):
        self.pubsub = self.redis.pubsub()
        self.pubsub.subscribe('delete')

        print('Waiting for delete messages')

        for item in self.pubsub.listen():
            try:
                if item['type'] == 'message' and item['channel'] == b'delete':
                    self.handle_delete_local(item['data'].decode('utf-8'))
            except:
                import traceback
                traceback.print_exc()

    def handle_delete_local(self, data):
        data = json.loads(data)

        user = data['user']
        coll = data['coll']
        rec = data['rec']
        type = data['type']

        if type not in (('user', 'coll', 'rec')):
            print('Unknown delete type ' + str(type))
            return

        glob_path, count = self._close_active_writers(user, coll, rec)

        if glob_path.endswith('/'):
            glob_path = os.path.dirname(glob_path)

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
            self._delete_decrease_size(user, coll, rec, type)
        elif type == 'coll':
            self._delete_decrease_size(user, coll, rec, type)

        with redis.utils.pipeline(self.redis) as pi:
            for key in keys_to_del:
                pi.delete(key)

    def _delete_rec_warc_key(self, user, coll, rec):
        with redis.utils.pipeline(self.redis) as pi:
            for key, n, v in self._iter_all_warcs(user, coll, rec):
                pi.hdel(key, n)

    def _delete_decrease_size(self, user, coll, rec, type):
        del_info = self.info_keys[type].format(user=user, coll=coll, rec=rec)
        try:
            length = int(self.redis.hget(del_info, 'size'))
        except:
            print('Error decreasing size')
            return

        with redis.utils.pipeline(self.redis) as pi:
            user_key = self.info_keys['user'].format(user=user)
            pi.hincrby(user_key, 'size', -length)

            if type == 'rec':
                coll_key = self.info_keys['coll'].format(user=user, coll=coll)
                pi.hincrby(coll_key, 'size', -length)


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
class SkipCheckingMultiFileWARCWriter(MultiFileWARCWriter):
    def __init__(self, *args, **kwargs):
        super(SkipCheckingMultiFileWARCWriter, self).__init__(*args, **kwargs)
        self.redis = kwargs.get('redis')
        self.skip_key_template = kwargs.get('skip_key_templ')

    def _is_write_req(self, req, params):
        if not req or not req.rec_headers or not self.skip_key_template:
            return False

        skip_key = res_template(self.skip_key_template, params)

        if self.redis.get(skip_key) == b'1':
            print('SKIPPING REQ', target_uri)
            return False

        return True

