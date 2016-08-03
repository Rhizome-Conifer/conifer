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

from io import BytesIO

from six.moves.urllib.parse import urlsplit
from tempfile import NamedTemporaryFile

from pywb.warc.cdxindexer import write_cdx_index
from pywb.utils.timeutils import timestamp20_now


class Migrater(object):
    ALPHA_NUM_RX = re.compile('[^\w-]')

    WB_URL_COLLIDE = re.compile('^([\d]+([\w]{2}_)?|([\w]{2}_))$')

    MIN_SIZE = 5000000000

    NEW_REMOTE_PATH = 'accounts/{0}/warcs/migrate-{0}-{1}-{2}.warc.gz'

    def __init__(self, src_redis_url, dst_redis_url, dest_prefix, dry_run=True):
        self.src_redis = redis.StrictRedis.from_url(src_redis_url, decode_responses=True)
        self.dst_redis = redis.StrictRedis.from_url(dst_redis_url, decode_responses=True)
        self.dry = dry_run

        self.s3conn = boto.connect_s3()

        parts = urlsplit(dest_prefix)
        self.dest_bucket_name = parts.netloc
        self.path_prefix = parts.path[1:]

        self.dest_bucket = self.s3conn.get_bucket(self.dest_bucket_name)

    def add_h_tables(self):
        for key in self.src_redis.scan_iter('h:*'):
            print(key)

            if key == 'h:reports':
                values = self.src_redis.lrange(key, 0, -1)
                #TODO
                print(type(values))

            else:
                values = self.src_redis.hgetall(key)
                if not self.dry:
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
        new_info['max_coll'] = '100'

        print('USER ' + to_key)
        print(new_info)
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

        # Collection Info
        if 'desc' not in collection:
            collection['desc'] = ''

        res = self.src_redis.hget(read_key, '@public')
        if res == '1':
            collection['r:@public'] = '1'

        print('  COLL: ' + to_key)
        print(collection)
        if not self.dry:
            self.dst_redis.hmset(to_key, collection)

        return orig_title

    def add_default_rec(self, user, coll, rec, title):
        key = 'r:{0}:{1}:{2}:info'.format(user, coll, rec)

        now = int(time.time())

        # create default recording
        recording = dict(id=rec,
                         title=title,
                         size='0',
                         created_at=now,
                         updated_at=now)

        print('  REC: ' + key)
        print(recording)
        if not self.dry:
            self.dst_redis.hmset(key, recording)

    def add_pages(self, user, coll, rec):
        from_key = '{0}:{1}:p'.format(user, coll)
        to_key = 'r:{0}:{1}:{2}:page'.format(user, coll, rec)

        pages = self.src_redis.smembers(from_key)

        new_pages = {}
        for page in pages:
            page = json.loads(page)

            timestamp = page.pop('ts', '0')
            page_key = page['url'] + ' ' + timestamp
            page['timestamp'] = timestamp

            new_pages[page_key] = json.dumps(page)

        print('  PAGES ' + to_key)
        print(new_pages)
        if not self.dry:
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

        self.add_default_rec(user, coll, rec, title)


        # Pages
        self.add_pages(user, coll, rec)


        # Warcs
        self.process_warcs(user, coll, rec)

    def process_warcs(self, user, coll, rec):
        from_key = '{0}:{1}:warc'.format(user, coll)
        to_key = 'r:{0}:{1}:{2}:warc'.format(user, coll, rec)

        warcs = self.src_redis.hgetall(from_key)

        print('  WARCS ' + to_key)

        remote_path = self.NEW_REMOTE_PATH.format(user, coll, timestamp20_now())

        remote_path = self.path_prefix + remote_path

        full_path = 's3://{0}/{1}'.format(self.dest_bucket_name, remote_path)
        print('Uploading ' + full_path)

        with NamedTemporaryFile() as fh:
            for name, path in iteritems(warcs):
                self.append_warc(fh, path)
                print(name, fh.tell())

            print('  TOTAL ', fh.tell())

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
            self.cdx_index(z_key, fh, filename)

            # SET WARC
            warc_key = 'r:{0}:{1}:{2}:warc'.format(user, coll, rec)
            if not self.dry:
                self.dst_redis.hset(warc_key, filename, full_path)

    def cdx_index(self, z_key, stream, filename):
        cdxout = BytesIO()
        write_cdx_index(cdxout, stream, filename,
                        cdxj=True, append_post=True)

        cdx_list = cdxout.getvalue().rstrip().split(b'\n')
        count = 0

        for cdx in cdx_list:
            if cdx and not self.dry:
                self.dst_redis.zadd(z_key, 0, cdx)
                count += 1

        print('  CDXJ ', count)



    def append_warc(self, dest, path):
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

    m = Migrater(src, dst,
                 os.environ['DEST_PREFIX'], dry_run=False)

    #m.add_h_tables()

    #m.process_user('<username>')


main()

