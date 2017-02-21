#!/bin/python

# Migration script for Redis keystore and WARC layout from Webrecorder 2.0 -> Webrecorder 3.0
#
# Assumes WARCs stored in S3
#
# Designed to run with S3 credentials and following env variables:
# SRC_REDIS: url to src redis
# DEST_REDIS: url to dest redis
# DEST_PREFIX: destination in form of 's3://bucket/prefix'

import redis

from six import iteritems

import json
import os
import time
import re
import boto
import shutil
import datetime
import sys
import logging

from io import BytesIO

from six.moves.urllib.parse import urlsplit
from tempfile import NamedTemporaryFile

from pywb.warc.cdxindexer import write_cdx_index
from pywb.utils.timeutils import timestamp20_now, timestamp_to_sec
from pywb.cdx.cdxobject import CDXObject


class Migrater(object):
    ALPHA_NUM_RX = re.compile('[^\w-]')

    WB_URL_COLLIDE = re.compile('^([\d]+([\w]{2}_)?|([\w]{2}_))$')

    MIN_SIZE = 5000000000

    NEW_REMOTE_PATH = 'accounts/{0}/warcs/migrate-{0}-{1}-{2}{3}.warc.gz'

    def __init__(self, src_redis_url, dst_redis_url, dest_prefix, dry_run=True):
        self.src_redis = redis.StrictRedis.from_url(src_redis_url, decode_responses=True)
        self.dst_redis = redis.StrictRedis.from_url(dst_redis_url, decode_responses=True)
        self.dry = dry_run

        self.s3conn = boto.connect_s3()

        parts = urlsplit(dest_prefix)
        self.dest_bucket_name = parts.netloc
        self.path_prefix = parts.path[1:]

        self.dest_bucket = self.s3conn.get_bucket(self.dest_bucket_name)

    def process_all_users(self):
        users = self.src_redis.hkeys('h:users')
        for user in users:
            self.process_user(user)

    def add_h_tables(self):
        for key in self.src_redis.scan_iter('h:*'):
            logging.info(key)

            if self.dst_redis.exists(key):
                continue

            if key == 'h:reports':
                values = self.src_redis.lrange(key, 0, -1)
                if self.dry:
                    continue

                for val in values:
                    self.dst_redis.rpush(key, val)

            else:
                values = self.src_redis.hgetall(key)
                if self.dry:
                    continue

                self.dst_redis.hmset(key, values)

    def add_user(self, user):
        from_key = 'u:{0}'.format(user)
        to_key = 'u:{0}:info'.format(user)

        userinfo = self.src_redis.hgetall(from_key)

        try:
            max_size = int(userinfo.get('max_len'))
        except:
            max_size = 0

        if max_size < self.MIN_SIZE:
            max_size = self.MIN_SIZE

        new_info = {}
        new_info['desc'] = userinfo.get('desc', '')
        new_info['max_size'] = max_size
        new_info['size'] = '0'
        new_info['max_coll'] = '1000'

        logging.info('USER: ' + to_key)
        if not self.dry:
            self.dst_redis.hmset(to_key, new_info)

    def add_coll(self, user, coll, coll_data):
        read_key = '{0}:{1}:r'.format(user, coll)
        to_key = 'c:{0}:{1}:info'.format(user, coll)

        collection = json.loads(coll_data)

        orig_title = collection.get('title', coll)

        collection['title'] = coll
        collection['id'] = coll
        collection['created_at'] = int(time.time())
        collection['size'] = '0'

        # Collection Info
        if 'desc' not in collection:
            collection['desc'] = ''

        res = self.src_redis.hget(read_key, '@public')
        if res == '1':
            collection['r:@public'] = '1'

        logging.info('  COLL: ' + to_key)
        if not self.dry:
            self.dst_redis.hmset(to_key, collection)

        return orig_title

    def add_rec(self, user, coll, rec, title):
        key = 'r:{0}:{1}:{2}:info'.format(user, coll, rec)

        now = int(time.time())

        # create default recording
        recording = dict(id=rec,
                         title=title)

        logging.info('  REC: ' + key)
        if self.dry:
            return

        if not self.dst_redis.exists(key):
            recording['size'] = '0'
            recording['updated_at'] = now
            recording['created_at'] = now

        self.dst_redis.hmset(key, recording)

    def add_pages(self, user, coll, rec, is_snapshot):
        from_key = '{0}:{1}:p'.format(user, coll)
        to_key = 'r:{0}:{1}:{2}:page'.format(user, coll, rec)

        pages = self.src_redis.smembers(from_key)

        new_pages = {}
        for page in pages:
            page = json.loads(page)

            if (page.get('tags') == ['snapshot']) != is_snapshot:
                continue

            timestamp = page.pop('ts', '0')
            page_key = page['url'] + ' ' + timestamp
            page['timestamp'] = timestamp

            new_pages[page_key] = json.dumps(page)

        logging.info('  PAGES: ' + str(len(new_pages)))

        #logging.info(new_pages)
        if self.dry:
            return

        if new_pages:
            self.dst_redis.hmset(to_key, new_pages)

    def process_user(self, user):
        user_key = self.add_user(user)

        colls = self.get_coll_list(user)

        for name, value in iteritems(colls):
            self.process_coll(user, name, value)


    def get_coll_list(self, user):
        return self.src_redis.hgetall('u:{0}:<colls>'.format(user))

    def process_coll(self, user, coll, coll_data):
        title = self.add_coll(user, coll, coll_data)

        # Recording Info
        rec = self.sanitize_title(title)

        self.add_rec(user, coll, rec, title)


        # Pages
        self.add_pages(user, coll, rec, False)


        # Warcs (non Snapshots)
        self.process_warcs(user, coll, rec, False)

        # Check for snapshots
        rec_static_snap = rec + '-static-snapshots'

        # Warcs for Snapshots
        if self.process_warcs(user, coll, rec_static_snap, True) > 0:
            logging.info('  HAS SNAPSHOTS')
            self.add_rec(user, coll, rec_static_snap, title + ' Static Snapshots')
            self.add_pages(user, coll, rec_static_snap, True)


    def process_warcs(self, user, coll, rec, is_snapshot):
        from_key = '{0}:{1}:warc'.format(user, coll)
        to_key = 'r:{0}:{1}:{2}:warc'.format(user, coll, rec)

        warcs = self.src_redis.hgetall(from_key)

        logging.info('  WARCS: ' + to_key)

        if is_snapshot:
            suffix = '-snapshot'
        else:
            suffix = ''

        remote_path = self.NEW_REMOTE_PATH.format(user, coll, timestamp20_now(), suffix)

        remote_path = self.path_prefix + remote_path

        full_path = 's3://{0}/{1}'.format(self.dest_bucket_name, remote_path)

        size = 0

        with NamedTemporaryFile() as fh:
            for name, path in iteritems(warcs):
                if name.endswith('-snapshot.warc.gz') != is_snapshot:
                    continue

                try:
                    self.append_warc(fh, path)
                    logging.info('    {0}: {1}'.format(name, fh.tell()))
                except:
                    logging.info('ERROR on ' + path)

            size = fh.tell()
            if not size:
                return size

            logging.info('  TOTAL: ' + str(size))
            logging.info('  Uploading ' + full_path)

            # UPLOAD
            if not self.dry:
                dest_key = self.dest_bucket.new_key(remote_path)

                fh.seek(0)

                dest_key.content_type = 'application/octet-stream'

                dest_key.set_contents_from_file(fh, replace=True)

            # CDXJ
            z_key = 'r:{0}:{1}:{2}:cdxj'.format(user, coll, rec)
            filename = os.path.basename(remote_path)
            fh.seek(0)

            min_, max_ = self.cdx_index(z_key, fh, filename)

            if self.dry:
                return

            # SET WARC
            warc_key = 'r:{0}:{1}:{2}:warc'.format(user, coll, rec)
            self.dst_redis.hset(warc_key, filename, full_path)

            # SIZE INC + TIME SET
            with redis.utils.pipeline(self.dst_redis) as pi:
                pi.hincrby('u:{0}:info'.format(user), 'size', size)
                pi.hincrby('c:{0}:{1}:info'.format(user, coll), 'size', size)

                rec_key = 'r:{0}:{1}:{2}:info'.format(user, coll, rec)
                pi.hincrby(rec_key, 'size', size)

                if min_:
                    pi.hset(rec_key, 'created_at', min_)

                if max_:
                    pi.hset(rec_key, 'updated_at', max_)

        return size

    def cdx_index(self, z_key, stream, filename):
        cdxout = BytesIO()
        write_cdx_index(cdxout, stream, filename,
                        cdxj=True, append_post=True)

        cdx_list = cdxout.getvalue().rstrip().split(b'\n')
        count = 0

        min_ = max_ = None

        for cdx in cdx_list:
            if cdx and not self.dry:
                self.dst_redis.zadd(z_key, 0, cdx)
                cdxobj = CDXObject(cdx)

                ts = cdxobj['timestamp']

                min_ = min(min_, ts) if min_ else ts
                max_ = max(max_, ts) if max_ else ts

                count += 1

        if count:
            min_ = timestamp_to_sec(min_)
            max_ = timestamp_to_sec(max_)

        logging.info('  CDXJ: {0} {1} {2}'.format(count, min_, max_))
        return min_, max_

    def append_warc(self, dest, path):
        if not path.startswith('s3://'):
            logging.info('SKIPPING INVALID ' + path)
            return

        parts = urlsplit(path)

        src_bucket = self.s3conn.get_bucket(parts.netloc)

        stream = src_bucket.get_key(parts.path)

        stream.open_read()

        shutil.copyfileobj(stream, dest)

    # from BaseController
    def sanitize_title(self, title):
        id = title.lower()
        id = id.replace(' ', '-')
        id = self.ALPHA_NUM_RX.sub('', id)
        if self.WB_URL_COLLIDE.match(id):
            id += '_'

        return id



def main():
    src = os.environ['SRC_REDIS']
    dst = os.environ['DEST_REDIS']

    logging.basicConfig(format='%(asctime)s: [%(levelname)s]: %(message)s', level=logging.INFO)

    m = Migrater(src, dst,
                 os.environ['DEST_PREFIX'], dry_run=False)

    m.add_h_tables()

    if len(sys.argv) > 1:
        m.process_user(sys.argv[0])

    else:
        m.process_all_users()


main()

