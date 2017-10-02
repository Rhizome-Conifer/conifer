from pywb.recorder.recorderapp import RecorderApp

from pywb.recorder.redisindexer import WritableRedisIndexer

from pywb.recorder.multifilewarcwriter import MultiFileWARCWriter

from pywb.recorder.filters import WriteRevisitDupePolicy, SkipDupePolicy
from pywb.recorder.filters import ExcludeHttpOnlyCookieHeaders
from pywb.recorder.filters import SkipRangeRequestFilter, SkipDefaultFilter

from pywb.indexer.cdxindexer import BaseCDXWriter, CDXJ

from pywb.utils.format import res_template
from pywb.utils.io import BUFF_SIZE

from webrecorder.utils import SizeTrackingReader, redis_pipeline

from webrecorder.load.wamloader import WAMLoader

import redis
import time
import json
import glob
import tempfile
import traceback
import logging

from bottle import Bottle, request, debug
from datetime import datetime
import os
from six import iteritems
from six.moves.urllib.parse import quote


# ============================================================================
class WebRecRecorder(object):
    def __init__(self, config=None):
        self.upstream_url = os.environ['WARCSERVER_HOST']

        self.record_root_dir = os.environ['RECORD_ROOT']

        self.warc_path_templ = config['warc_path_templ']
        self.warc_path_templ = self.record_root_dir + self.warc_path_templ

        self.cdxj_key_templ = config['cdxj_key_templ']

        self.info_keys = config['info_key_templ']

        self.coll_list_key_templ = config['coll_list_key_templ']
        self.rec_list_key_templ = config['rec_list_key_templ']

        self.warc_key_templ = config['warc_key_templ']

        self.temp_prefix = config['temp_prefix']
        self.user_usage_key = config['user_usage_key']
        self.temp_usage_key = config['temp_usage_key']

        self.full_warc_prefix = config['full_warc_prefix']

        self.name = config['recorder_name']

        self.del_templ = config['del_templ']

        self.accept_colls = config['recorder_accept_colls']

        self.config = config

        self.redis_base_url = os.environ['REDIS_BASE_URL']
        self.redis = redis.StrictRedis.from_url(self.redis_base_url)

    def init_app(self, storage_committer):
        self.storage_committer = storage_committer

        self.init_recorder()

        self.app = Bottle()

        self.app.mount('/record', self.recorder)

        self.app.delete('/delete', callback=self.delete)
        self.app.get('/rename', callback=self.rename)

        debug(True)

    def init_indexer(self):
        return WebRecRedisIndexer(
            name=self.name,
            redis=self.redis,

            cdx_key_template=self.cdxj_key_templ,
            file_key_template=self.warc_key_templ,
            rel_path_template=self.warc_path_templ,

            full_warc_prefix=self.full_warc_prefix,

            #dupe_policy=WriteRevisitDupePolicy(),
            dupe_policy=SkipDupePolicy(),

            size_keys=self.info_keys.values(),
            rec_info_key_templ=self.info_keys['rec'],

            config=self.config,
        )

    @staticmethod
    def make_wr_indexer(config):
        return WebRecRecorder(config).init_indexer()

    def init_recorder(self):
        self.dedup_index = self.init_indexer()

        writer = SkipCheckingMultiFileWARCWriter(dir_template=self.warc_path_templ,
                                     dedup_index=self.dedup_index,
                                     redis=self.redis,
                                     key_template=self.info_keys['rec'],
                                     header_filter=ExcludeHttpOnlyCookieHeaders(),
                                     config=self.config)

        self.writer = writer

        skip_filters = [SkipRangeRequestFilter(),
                        ExtractPatchingFilter()]

        recorder_app = RecorderApp(self.upstream_url,
                                   writer,
                                   skip_filters=skip_filters,
                                   #accept_colls=self.accept_colls,
                                   create_buff_func=self.create_buffer)

        self.recorder = recorder_app

    def create_buffer(self, params, name):
        info_key = res_template(self.info_keys['rec'], params)
        return TempWriteBuffer(self.redis, info_key, name, params['url'])

    def get_profile(self, scheme, profile):
        res = self.redis.hgetall('st:' + profile)
        if not res:
            return dict()

        return dict((n.decode('utf-8'), v.decode('utf-8')) for n, v in res.items())

    def _iter_all_warcs(self, user, coll, rec):
        warc_key = self.warc_key_templ.format(user=user, coll=coll, rec=rec)

        allwarcs = {}

        if rec == '*':
            for key in self.redis.scan_iter(warc_key):
                key = key.decode('utf-8')
                allwarcs[key] = self.redis.hgetall(key)
        else:
            allwarcs[warc_key] = self.redis.hgetall(warc_key)

        for key, warc_map in iteritems(allwarcs):
            for n, v in iteritems(warc_map):
                n = n.decode('utf-8')
                yield key, n, v.decode('utf-8')

    # Messaging ===============
    def msg_listen_loop(self):
        self.pubsub = self.redis.pubsub()

        self.pubsub.subscribe('delete')
        self.pubsub.subscribe('rename')
        self.pubsub.subscribe('close_rec')
        self.pubsub.subscribe('close_idle')

        print('Waiting for messages')

        for item in self.pubsub.listen():
            try:
                if item['type'] != 'message':
                    continue

                if item['channel'] == b'delete':
                    self.handle_delete_local(item['data'].decode('utf-8'))

                elif item['channel'] == b'rename':
                    self.handle_rename_local(item['data'].decode('utf-8'))

                elif item['channel'] == b'close_idle':
                    self.recorder.writer.close_idle_files()

                elif item['channel'] == b'close_rec':
                    self.recorder.writer.close_key(item['data'].decode('utf-8'))

            except:
                traceback.print_exc()

    def queue_message(self, channel, message):
        res = self.redis.publish(channel, json.dumps(message))
        return (res > 0)

    # Rename Handling ===============
    def rename(self):
        try:
            return self.rename_actual()
        except:
            traceback.print_exc()

    def rename_actual(self):
        from_user = request.query.getunicode('from_user', '')
        from_coll = request.query.getunicode('from_coll', '')
        from_rec = request.query.getunicode('from_rec', '*')

        to_user = request.query.getunicode('to_user', '')
        to_coll = request.query.getunicode('to_coll', '')
        to_rec = request.query.getunicode('to_rec', '*')

        to_title = request.query.getunicode('to_title', '')

        if not from_user or not from_coll or not to_user or not to_coll:
            return {'error_message': 'user or coll params missing'}

        if (from_rec == '*' or to_rec == '*') and (from_rec != to_rec):
            return {'error_message': 'must specify rec name or "*" if moving entire coll'}

        # Move the redis keys, this performs the move as far as user is concerned
        match_pattern = ':' + from_user + ':' + from_coll + ':'
        replace_pattern = ':' + to_user + ':' + to_coll + ':'

        if to_rec != '*':
            match_pattern += from_rec + ':'
            replace_pattern += to_rec + ':'

        moves = {}

        for key in self.redis.scan_iter(match='*' + match_pattern + '*'):
            key = key.decode('utf-8')
            moves[key] = key.replace(match_pattern, replace_pattern)

        # Get Info Keys
        to_user_key = self.info_keys['user'].format(user=to_user)
        from_user_key = self.info_keys['user'].format(user=from_user)

        if to_rec != '*':
            to_coll_key = self.info_keys['coll'].format(user=to_user, coll=to_coll)
            from_coll_key = self.info_keys['coll'].format(user=from_user, coll=from_coll)

            to_rec_list_key = self.rec_list_key_templ.format(user=to_user, coll=to_coll)
            from_rec_list_key = self.rec_list_key_templ.format(user=from_user, coll=from_coll)

            info_key = self.info_keys['rec'].format(user=from_user, coll=from_coll, rec=from_rec)

            to_id = to_rec
        else:
            info_key = self.info_keys['coll'].format(user=from_user, coll=from_coll)

            to_coll_list_key = self.coll_list_key_templ.format(user=to_user)
            from_coll_list_key = self.coll_list_key_templ.format(user=from_user)

            to_id = to_coll

        the_size = int(self.redis.hget(info_key, 'size'))

        with redis_pipeline(self.redis) as pi:
            # Fix Id
            pi.hset(info_key, 'id', to_id)

            # Change title, if provided
            if to_title:
                pi.hset(info_key, 'title', to_title)

            # actual rename
            for from_key, to_key in iteritems(moves):
                pi.rename(from_key, to_key)

        with redis_pipeline(self.redis) as pi:
            # change user size, if different users
            if to_user_key != from_user_key:
                pi.hincrby(from_user_key, 'size', -the_size)
                pi.hincrby(to_user_key, 'size', the_size)

            # if collection or user names different, update list
            if to_rec == '*' and (to_user_key != from_user_key or to_coll != from_coll):
                pi.srem(from_coll_list_key, from_coll)
                pi.sadd(to_coll_list_key, to_coll)

            # change coll size if moving rec and different colls
            if to_rec != '*' and to_coll_key != from_coll_key:
                pi.hincrby(from_coll_key, 'size', -the_size)
                pi.hincrby(to_coll_key, 'size', the_size)

            # update coll list
            if to_rec != '*':
                pi.srem(from_rec_list_key, from_rec)
                pi.sadd(to_rec_list_key, to_rec)

            # check if usage stats need updating
            if (from_user.startswith(self.temp_prefix) and not
                to_user.startswith(self.temp_prefix)):
                # remove temp usage data, add user usage data
                ts = datetime.now().date().isoformat()
                pi.hincrby(self.temp_usage_key, ts, -the_size)
                pi.hincrby(self.user_usage_key, ts, the_size)

        # rename WARCs (only if switching users)
        replace_list = []

        for key, name, url in self._iter_all_warcs(to_user, to_coll, to_rec):
            if not url.startswith(self.full_warc_prefix):
                continue

            filename = url[len(self.full_warc_prefix):]

            new_filename = filename.replace(from_user + '/', to_user + '/')

            repl = dict(key=key,
                        name=name,
                        old_v=filename,
                        new_v=new_filename)

            replace_list.append(repl)

        if replace_list:
            if not self.queue_message('rename', {'replace_list': replace_list}):
                return {'error_message': 'no local clients'}

        #if self.storage_committer:
        #    storage = self.storage_committer.get_storage(to_user, to_coll, to_rec)
        #    if storage and not storage.rename(from_user, from_coll, from_rec,
        #                                      to_user, to_coll, to_rec):
        #        return {'error_message': 'remote rename failed'}

        return {'success': to_user + ':' + to_coll + ':' + to_rec}

    def handle_rename_local(self, data):
        data = json.loads(data)

        for repl in data['replace_list']:
            if os.path.isfile(repl['old_v']):
                try:
                    self.recorder.writer.close_file(repl['old_v'])

                    if repl['old_v'] != repl['new_v']:
                        os.renames(repl['old_v'], repl['new_v'])
                        self.redis.hset(repl['key'], repl['name'], self.full_warc_prefix + repl['new_v'])
                except Exception as e:
                    print(e)

    # Delete Handling ===========

    def delete(self):
        try:
            return self.delete_actual()
        except:
            traceback.print_exc()

    def delete_actual(self):
        user = request.query.getunicode('user', '')
        coll = request.query.getunicode('coll', '*')
        rec = request.query.getunicode('rec', '*')
        type = request.query.getunicode('type')

        local_delete_list = []
        remote_delete_list = []

        for key, n, url in self._iter_all_warcs(user, coll, rec):
            if url.startswith(self.full_warc_prefix):
                filename = url[len(self.full_warc_prefix):]
                local_delete_list.append(filename)
            else:
                remote_delete_list.append(url)

        message = {}

        if local_delete_list:
            message = dict(delete_list=local_delete_list)

        if type == 'user':
            message['delete_user'] = user

        if not self.queue_message('delete', message):
            return {'error_message': 'no local clients'}

        try:
            self._delete_redis_keys(type, user, coll, rec)
        except Exception as e:
            traceback.print_exc()
            return {'error_message': str(e)}

        if not self.storage_committer:
            return {}

        storage = self.storage_committer.get_storage(user, coll, rec)
        if not storage:
            return {}

        res = None

        if type == 'user':
            res = storage.delete_user(user)
        elif remote_delete_list:
            res = storage.delete(remote_delete_list)
        else:
            return {}

        if not res:
            return {'error_message': 'remote delete failed'}

        return {}

    def _delete_redis_keys(self, type, user, coll, rec):
        key_templ = self.del_templ.get(type)
        if not key_templ:
            print('Unknown delete type ' + str(type))
            return

        key_pattern = key_templ.format(user=user, coll=coll, rec=rec)
        keys_to_del = list(self.redis.scan_iter(match=key_pattern))

        if type != 'user':
            del_info = self.info_keys[type].format(user=user, coll=coll, rec=rec)

            try:
                length = int(self.redis.hget(del_info, 'size'))
            except:
                print('Error decreasing size')
                return
        else:
            length = 0

        with redis_pipeline(self.redis) as pi:
            if type == 'coll':
                coll_list_key = self.coll_list_key_templ.format(user=user)
                pi.srem(coll_list_key, coll)

            elif type == 'rec':
                rec_list_key = self.rec_list_key_templ.format(user=user, coll=coll)
                pi.srem(rec_list_key, rec)

            if length > 0:
                user_key = self.info_keys['user'].format(user=user)
                pi.hincrby(user_key, 'size', -length)

                if type == 'rec':
                    coll_key = self.info_keys['coll'].format(user=user, coll=coll)
                    pi.hincrby(coll_key, 'size', -length)

            for key in keys_to_del:
                pi.delete(key)

    def handle_delete_local(self, data):
        data = json.loads(data)

        delete_list = data.get('delete_list', [])

        for filename in delete_list:
            if os.path.isfile(filename):
                try:
                    self.recorder.writer.close_file(filename)
                    print('Deleting ' + filename)
                    os.remove(filename)
                except Exception as e:
                    print(e)

        delete_user = data.get('delete_user')
        if not delete_user:
            return

        user_path = self.warc_path_templ.format(user=delete_user)
        user_path += '*.warc.gz'

        for filename in glob.glob(user_path):
            try:
                print('Deleting Local WARC: ' + filename)
                os.remove(filename)

            except Exception as e:
                print(e)


# ============================================================================
class ExtractPatchingFilter(SkipDefaultFilter):
    def skip_response(self, path, req_headers, resp_headers, params):
        if super(ExtractPatchingFilter, self).skip_response(path, req_headers, resp_headers, params):
            return True

        source = resp_headers.get('Warcserver-Source-Coll')
        if source.startswith('r:'):
            return True

        sources = params.get('sources', '*')
        if not sources or sources == '*':
            return False

        sources = sources.split(',')

        if source in sources:
            return False

        patch_rec = params.get('param.recorder.patch_rec')
        if not patch_rec:
            return True

        user = params['param.user']
        coll = params['param.coll']

        params['param.recorder.rec'] = patch_rec
        resp_headers['Recorder-Rec'] = quote(patch_rec, safe='/*')

        return False


# ============================================================================
class CDXJIndexer(CDXJ, BaseCDXWriter):
    wam_loader = None

    def write_cdx_line(self, out, entry, filename):
        source_uri = entry.record.rec_headers.get_header('WARC-Source-URI')
        if source_uri and self.wam_loader:
            res = self.wam_loader.find_archive_for_url(source_uri)
            if res:
                entry['orig_source_id'] = res[0]

        super(CDXJIndexer, self).write_cdx_line(out, entry, filename)


# ============================================================================
class WebRecRedisIndexer(WritableRedisIndexer):
    def __init__(self, *args, **kwargs):
        super(WebRecRedisIndexer, self).__init__(*args, **kwargs)

        self.size_keys = kwargs.get('size_keys', [])
        self.rec_info_key_templ = kwargs.get('rec_info_key_templ')

        config = kwargs['config']

        self.temp_prefix = config['temp_prefix']

        self.user_usage_key = config['user_usage_key']
        self.temp_usage_key = config['temp_usage_key']

        self.rate_limit_key = config['rate_limit_key']

        self.rate_limit_hours = int(os.environ.get('RATE_LIMIT_HOURS', 0))
        self.rate_limit_ttl = self.rate_limit_hours * 60 * 60

        self.coll_cdxj_key = config['coll_cdxj_key_templ']

        self.wam_loader = WAMLoader()

        # set shared wam_loader for CDXJIndexer index writers
        CDXJIndexer.wam_loader = self.wam_loader

    def get_rate_limit_key(self, params):
        if not self.rate_limit_key or not self.rate_limit_ttl:
            return None

        ip = params.get('param.ip')
        if not ip:
            return None

        h = time.strftime("%H")
        rate_limit_key = self.rate_limit_key.format(ip=ip, H=h)
        return rate_limit_key

    def add_urls_to_index(self, stream, params, filename, length):
        upload_key = params.get('param.upid')
        if upload_key:
            stream = SizeTrackingReader(stream, length, self.redis, upload_key)

        params['writer_cls'] = CDXJIndexer

        cdx_list = (super(WebRecRedisIndexer, self).
                      add_urls_to_index(stream, params, filename, length))


        # if replay key exists, add to it as well!
        coll_cdxj_key = res_template(self.coll_cdxj_key, params)
        if self.redis.exists(coll_cdxj_key):
            for cdx in cdx_list:
                if cdx:
                    self.redis.zadd(coll_cdxj_key, 0, cdx)

        ts = datetime.now().date().isoformat()
        ts_sec = str(int(time.time()))

        with redis_pipeline(self.redis) as pi:
            for key_templ in self.size_keys:
                key = res_template(key_templ, params)
                pi.hincrby(key, 'size', length)

                if key_templ == self.rec_info_key_templ and cdx_list:
                    pi.hset(key, 'updated_at', ts_sec)

            # write size to usage hashes
            if 'param.user' in params:
                if params['param.user'].startswith(self.temp_prefix):
                    key = self.temp_usage_key

                    # rate limiting
                    rate_limit_key = self.get_rate_limit_key(params)
                    if rate_limit_key:
                        pi.incrby(rate_limit_key, length)
                        pi.expire(rate_limit_key, self.rate_limit_ttl)

                else:
                    key = self.user_usage_key

                if key:
                    pi.hincrby(key, ts, length)

        return cdx_list


# ============================================================================
class SkipCheckingMultiFileWARCWriter(MultiFileWARCWriter):
    def __init__(self, *args, **kwargs):
        config = kwargs.get('config')
        kwargs['filename_template'] = config['warc_name_templ']
        kwargs['max_size'] = int(config['max_warc_size'])
        kwargs['max_idle_secs'] = int(config['open_rec_ttl'])

        self.skip_key_template = config['skip_key_templ']

        super(SkipCheckingMultiFileWARCWriter, self).__init__(*args, **kwargs)

        self.redis = kwargs.get('redis')
        self.info_key = kwargs.get('key_template')

        self.open_rec_key = config['open_rec_key_templ']
        self.open_rec_ttl = kwargs['max_idle_secs']

        self.user_key = config['info_key_templ']['user']

    def is_rec_open(self, params):
        open_key = res_template(self.open_rec_key, params)

        # update ttl for open recroding key, if it exists
        # if not, abort opening new warc file here
        if not self.redis.expire(open_key, self.open_rec_ttl):
            # if expire fails, recording not open!
            logging.debug('Writing skipped, recording not open for write: ' + open_key)
            return False

        return True

    def write_stream_to_file(self, params, stream):
        upload_id = params.get('param.upid')
        def write_callback(out, filename):
            while True:
                buff = stream.read(BUFF_SIZE)
                if not buff:
                    break

                out.write(buff)
                if upload_id:
                    self.redis.hincrby(upload_id, 'size', len(buff))

        return self._write_to_file(params, write_callback)

    def _is_write_resp(self, resp, params):
        if not self.is_rec_open(params):
            return False

        user_key = res_template(self.user_key, params)
        size, max_size = self.redis.hmget(user_key, ['size', 'max_size'])

        size = int(size or 0)
        max_size = int(max_size or 0)
        length = int(resp.length or resp.rec_headers.get_header('Content-Length') or 0)

        if size + length > max_size:
            print('New Record for {0} exceeds max size, not recording!'.format(params['url']))
            return False

        return True

    def _is_write_req(self, req, params):
        if not req or not req.rec_headers or not self.skip_key_template:
            return False

        skip_key = res_template(self.skip_key_template, params)

        if self.redis.get(skip_key) == b'1':
            print('SKIPPING REQ', params.get('url'))
            return False

        return True


# ============================================================================
class TempWriteBuffer(tempfile.SpooledTemporaryFile):
    def __init__(self, redis, info_key, class_name, url):
        super(TempWriteBuffer, self).__init__(max_size=512*1024)
        self.redis = redis
        self.info_key = info_key
        self.redis.hincrby(self.info_key, 'pending_count', 1)
        self._wsize = 0

    def write(self, buff):
        super(TempWriteBuffer, self).write(buff)
        length = len(buff)
        self._wsize += length
        self.redis.hincrby(self.info_key, 'pending_size', length)

    def close(self):
        try:
            super(TempWriteBuffer, self).close()
        except:
            traceback.print_exc()

        self.redis.hincrby(self.info_key, 'pending_size', -self._wsize)
        self.redis.hincrby(self.info_key, 'pending_count', -1)


