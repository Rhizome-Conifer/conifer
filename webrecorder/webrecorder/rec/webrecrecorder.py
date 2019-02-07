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

import webrecorder.rec.storage.storagepaths as storagepaths
from webrecorder.rec.storage.local import DirectLocalFileStorage

from webrecorder.models.base import BaseAccess
from webrecorder.models import Recording, Collection, Stats

import redis
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

logger = logging.getLogger('wr.io')


# ============================================================================
class WebRecRecorder(object):
    def __init__(self, config=None):
        self.upstream_url = os.environ['WARCSERVER_HOST']

        self.record_root_dir = os.environ['RECORD_ROOT']

        self.warc_path_templ = config['warc_path_templ']
        self.warc_path_templ = self.record_root_dir + self.warc_path_templ

        #self.cdxj_key_templ = config['cdxj_key_templ']

        self.info_keys = config['info_key_templ']

        self.rec_map_key_templ = config['rec_map_key_templ']
        self.rec_map_key_templ = config['rec_map_key_templ']

        self.name = config['recorder_name']

        self.del_templ = config['del_templ']

        self.accept_colls = config['recorder_accept_colls']

        self.config = config

        self.redis_base_url = os.environ['REDIS_BASE_URL']
        self.redis = redis.StrictRedis.from_url(self.redis_base_url, decode_responses=True)

        self.local_storage = DirectLocalFileStorage()

        self.msg_ge = None
        self.pubsub = None
        self.writer = None

    def init_app(self, storage_committer=None):
        self.storage_committer = storage_committer

        self.init_recorder()

        self.app = Bottle()

        self.app.mount('/record', self.recorder)

        debug(True)

    def close(self):
        try:
            if self.pubsub:
                self.pubsub.close()
        except Exception as e:
            logger.error(str(e))

        try:
            if self.writer:
                self.writer.close()
        except Exception as e:
            logger.error(str(e))

    def init_indexer(self):
        return WebRecRedisIndexer(
            name=self.name,
            redis=self.redis,

            cdx_key_template=Recording.CDXJ_KEY,
            file_key_template=Recording.COLL_WARC_KEY,
            rel_path_template=self.warc_path_templ,

            full_warc_prefix=storagepaths.FULL_WARC_PREFIX,

            dupe_policy=WriteRevisitDupePolicy(),
            #dupe_policy=SkipDupePolicy(),

            info_keys=self.info_keys.values(),
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
                                   create_buff_func=writer.create_write_buffer)

        self.recorder = recorder_app

    # Messaging ===============
    def msg_listen_loop(self):
        self.pubsub = self.redis.pubsub()

        self.pubsub.subscribe('close_rec')
        self.pubsub.subscribe('close_idle')

        self.pubsub.subscribe('handle_delete_file')
        self.pubsub.subscribe('handle_delete_dir')

        logger.info('Recorder pubsub: Waiting for messages')

        try:
            for item in self.pubsub.listen():
                self.handle_message(item)

        except:
            logger.info('Recorder pubsub: Message Loop Done')

    def handle_message(self, item):
        try:
            if item['type'] != 'message':
                return

            elif item['channel'] == 'close_idle':
                self.recorder.writer.close_idle_files()

            elif item['channel'] == 'close_rec':
                self.recorder.writer.close_key(item['data'])

            elif item['channel'] == 'handle_delete_file':
                self.handle_delete_file(item['data'])

            elif item['channel'] == 'handle_delete_dir':
                self.handle_delete_dir(item['data'])

        except:
            traceback.print_exc()

    def handle_delete_file(self, uri):
        # determine if local file
        filename = storagepaths.strip_prefix(uri)

        closed = self.recorder.writer.close_file(filename)

        self.local_storage.delete_file(filename)

    def handle_delete_dir(self, local_dir):
        self.local_storage.delete_collection_dir(local_dir)

    def queue_message(self, channel, message):
        res = self.redis.publish(channel, json.dumps(message))
        return (res > 0)


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

        self.info_keys = kwargs.get('info_keys', [])
        self.rec_info_key_templ = kwargs.get('rec_info_key_templ')

        config = kwargs['config']

        self.coll_cdxj_key = Collection.COLL_CDXJ_KEY
        self.rec_file_key_template = Recording.REC_WARC_KEY

        self.wam_loader = WAMLoader()

        # set shared wam_loader for CDXJIndexer index writers
        CDXJIndexer.wam_loader = self.wam_loader

        self.stats = Stats(self.redis)

    def add_warc_file(self, full_filename, params):
        base_filename = self._get_rel_or_base_name(full_filename, params)
        file_key = res_template(self.file_key_template, params)
        rec_key = res_template(self.rec_file_key_template, params)

        full_load_path = storagepaths.add_local_store_prefix(full_filename)

        self.redis.hset(file_key, base_filename, full_load_path)
        self.redis.sadd(rec_key, base_filename)

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

        dt_now = datetime.utcnow()

        ts_sec = int(dt_now.timestamp())

        with redis_pipeline(self.redis) as pi:
            for key_templ in self.info_keys:
                key = res_template(key_templ, params)
                pi.hincrby(key, 'size', length)
                if cdx_list:
                    pi.hset(key, 'updated_at', ts_sec)
                    if key_templ == self.rec_info_key_templ:
                        pi.hset(key, 'recorded_at', ts_sec)

        self.stats.incr_record(params, length, cdx_list)

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

    def create_write_buffer(self, params, name):
        rec_id = params.get('param.recorder.rec') or params.get('param.rec')
        recording = Recording(my_id=rec_id,
                              redis=self.redis,
                              access=BaseAccess())

        params['recording'] = recording

        return TempWriteBuffer(recording, name, params['url'])

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
        if not params['recording'].is_open():
            logger.debug('Record Writer: Writing skipped, recording not open for write')
            return False

        user_key = res_template(self.user_key, params)
        size, max_size = self.redis.hmget(user_key, ['size', 'max_size'])

        size = int(size or 0)
        max_size = int(max_size or 0)

        length = resp.length or resp.rec_headers.get_header('Content-Length')
        if length is None:
            self.ensure_digest(resp, block=True, payload=True)
            resp.length = resp.payload_length
            length = resp.length

        if size + length > max_size:
            logger.error('Record Writer: New Record for {0} exceeds max size, not recording!'.format(params['url']))
            return False

        return True

    def _is_write_req(self, req, params):
        if not req or not req.rec_headers or not self.skip_key_template:
            return False

        skip_key = res_template(self.skip_key_template, params)

        if self.redis.get(skip_key) == '1':
            logger.debug('Record Writer: Skipping Request for: ' + params.get('url'))
            return False

        return True


# ============================================================================
class TempWriteBuffer(tempfile.SpooledTemporaryFile):
    def __init__(self, recording, class_name, url):
        super(TempWriteBuffer, self).__init__(max_size=512*1024)
        self.recording = recording
        self.class_name = class_name

        self.recording.inc_pending_count()

        self._wsize = 0

    def write(self, buff):
        super(TempWriteBuffer, self).write(buff)
        length = len(buff)
        self._wsize += length

        self.recording.inc_pending_size(length)

    def close(self):
        try:
            super(TempWriteBuffer, self).close()
        except:
            traceback.print_exc()

        self.recording.dec_pending_count_and_size(self._wsize)


