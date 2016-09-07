from recorder.recorderapp import RecorderApp

from recorder.redisindexer import WritableRedisIndexer

from recorder.warcwriter import MultiFileWARCWriter
from recorder.filters import WriteRevisitDupePolicy
from recorder.filters import ExcludeSpecificHeaders

import redis
import time
import json
import glob

from webagg.utils import res_template, ParamFormatter

from bottle import Bottle, request, debug, response
import os
import shutil
from six import iteritems
from six.moves.urllib.parse import quote

import gevent


# ============================================================================
class WebRecRecorder(object):
    def __init__(self, config=None, storage_committer=None):
        self.storage_committer = storage_committer

        self.upstream_url = os.environ['WEBAGG_HOST']

        self.record_root_dir = os.environ['RECORD_ROOT']

        self.warc_path_templ = config['warc_path_templ']
        self.warc_path_templ = self.record_root_dir + self.warc_path_templ

        self.cdxj_key_templ = config['cdxj_key_templ']

        self.info_keys = config['info_key_templ']

        self.warc_key_templ = config['warc_key_templ']

        self.warc_name_templ = config['warc_name_templ']

        self.full_warc_prefix = config['full_warc_prefix']

        self.temp_prefix = config['temp_prefix']

        self.name = config['recorder_name']

        self.del_templ = config['del_templ']

        self.skip_key_templ = config['skip_key_templ']

        self.redis_base_url = os.environ['REDIS_BASE_URL']
        self.redis = redis.StrictRedis.from_url(self.redis_base_url)

        self.app = Bottle()
        self.recorder = self.init_recorder()

        self.app.mount('/record', self.recorder)

        self.app.delete('/delete', callback=self.delete)
        self.app.get('/rename', callback=self.rename)

        debug(True)

        gevent.spawn(self.msg_listen_loop)

    def init_recorder(self):
        self.dedup_index = WebRecRedisIndexer(
            name=self.name,
            redis=self.redis,

            cdx_key_template=self.cdxj_key_templ,
            file_key_template=self.warc_key_templ,
            rel_path_template=self.warc_path_templ,

            full_warc_prefix=self.full_warc_prefix,

            dupe_policy=WriteRevisitDupePolicy(),

            size_keys=self.info_keys.values(),
            rec_info_key_templ=self.info_keys['rec'],
        )


        header_filter = ExcludeSpecificHeaders(['Set-Cookie', 'Cookie'])

        writer = SkipCheckingMultiFileWARCWriter(dir_template=self.warc_path_templ,
                                     filename_template=self.warc_name_templ,
                                     dedup_index=self.dedup_index,
                                     redis=self.redis,
                                     skip_key_templ=self.skip_key_templ,
                                     key_template=self.info_keys['rec'],
                                     header_filter=header_filter)

        self.writer = writer
        recorder_app = RecorderApp(self.upstream_url,
                                   writer,
                                   accept_colls='live')

        return recorder_app

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

        print('Waiting for messages')

        for item in self.pubsub.listen():
            try:
                if item['type'] != 'message':
                    continue

                if item['channel'] == b'delete':
                    self.handle_delete_local(item['data'].decode('utf-8'))

                elif item['channel'] == b'rename':
                    self.handle_rename_local(item['data'].decode('utf-8'))

            except:
                import traceback
                traceback.print_exc()

    def queue_message(self, channel, message):
        res = self.redis.publish(channel, json.dumps(message))
        return (res > 0)

    # Rename Handling ===============

    def rename(self):
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

            info_key = self.info_keys['rec'].format(user=from_user, coll=from_coll, rec=from_rec)

            to_id = to_rec
        else:
            info_key = self.info_keys['coll'].format(user=from_user, coll=from_coll)

            to_id = to_coll

        the_size = int(self.redis.hget(info_key, 'size'))

        with redis.utils.pipeline(self.redis) as pi:
            # Fix Id
            pi.hset(info_key, 'id', to_id)

            # Change title, if provided
            if to_title:
                pi.hset(info_key, 'title', to_title)

            # actual rename
            for from_key, to_key in iteritems(moves):
                pi.rename(from_key, to_key)

        with redis.utils.pipeline(self.redis) as pi:
            # change user size, if different users
            if to_user_key != from_user_key:
                pi.hincrby(from_user_key, 'size', -the_size)
                pi.hincrby(to_user_key, 'size', the_size)

            # change coll size if moving rec and different colls
            if to_rec != '*' and to_coll_key != from_coll_key:
                pi.hincrby(from_coll_key, 'size', -the_size)
                pi.hincrby(to_coll_key, 'size', the_size)

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
                        self.redis.hset(repl['key'], repl['name'], repl['new_v'])
                except Exception as e:
                    print(e)

    # Delete Handling ===========

    def delete(self):
        try:
            return self.delete_actual()
        except:
            import traceback
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
            import traceback
            traceback.print_exc()
            return {'error_message': str(e)}

        if not self.storage_committer:
            return {}

        storage = self.storage_committer.get_storage(user, coll, rec)
        if not storage:
            return {}

        if type == 'user':
            res = storage.delete_user(user)
        elif remote_delete_list:
            res = storage.delete(remote_delete_list)

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

        with redis.utils.pipeline(self.redis) as pi:
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
        self.info_key = kwargs.get('key_template')

    def allow_new_file(self, filename, params):
        key = res_template(self.info_key, params)

        # ensure recording exists before writing anything
        # if not, abort opening new warc file here
        if not self.redis.exists(key):
            print('Writing skipped, recording does not exist for ' + filename)
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

