import redis
import os
import json
import glob
import requests
import shutil
import time

from webrecorder.models import User, Collection
from webrecorder.models.base import BaseAccess

import logging
logger = logging.getLogger('wr.io')


# ============================================================================
class TempChecker(object):
    USER_DIR_IDLE_TIME = 1800

    def __init__(self, config):
        super(TempChecker, self).__init__()

        self.redis_base_url = os.environ['REDIS_BASE_URL']

        self.data_redis = redis.StrictRedis.from_url(self.redis_base_url,
                                                     decode_responses=True)

        # beaker always uses db 0, so using db 0
        #self.redis_base_url = self.redis_base_url.rsplit('/', 1)[0] + '/0'
        self.sesh_redis = redis.StrictRedis.from_url(os.environ['REDIS_SESSION_URL'],
                                                     decode_responses=True)

        self.USER_DIR_IDLE_TIME = config['coll_cdxj_ttl']

        self.temp_prefix = config['temp_prefix']
        self.record_root_dir = os.environ['RECORD_ROOT']
        #self.glob_pattern = os.path.join(self.record_root_dir, self.temp_prefix + '*')
        #self.temp_dir = os.path.join(self.record_root_dir, 'temp')

        self.sesh_key_template = config['session.key_template']

        logger.info('Temp Check Root: ' + self.record_root_dir)

    def delete_if_expired(self, temp_user, temp_dir):
        temp_key = 't:' + temp_user
        sesh = self.sesh_redis.get(temp_key)

        if sesh == 'commit-wait':
            try:
                if not os.path.isdir(temp_dir):
                    logger.debug('TempChecker: Remove Session For Already Deleted Dir: ' + temp_dir)
                    self.sesh_redis.delete(temp_key)
                    return True

                logger.debug('TempChecker: Removing if empty: ' + temp_dir)
                os.rmdir(temp_dir)
                #shutil.rmtree(temp_dir)
                logger.debug('TempChecker: Deleted empty dir: ' + temp_dir)

                self.sesh_redis.delete(temp_key)

            except Exception as e:
                logger.debug('TempChecker: Waiting for commit')
                return False

        # temp user key exists
        elif self.data_redis.exists(User.INFO_KEY.format(user=temp_user)):
            # if user still active, don't remove
            if self.sesh_redis.get(self.sesh_key_template.format(sesh)):
                #print('Skipping active temp ' + temp)
                return False

            # delete user
            logger.debug('TempChecker: Deleting expired user: ' + temp_user)

            user = User(my_id=temp_user,
                        redis=self.data_redis,
                        access=BaseAccess())

            wait_to_delete = False

            for collection in user.get_collections(load=False):
                for recording in collection.get_recordings(load=False):
                    if recording.is_open(extend=False):
                        recording.set_closed()
                        logger.debug('TempChecker: Closing temp recording: ' + recording.my_id)
                        wait_to_delete = True

            if wait_to_delete:
                return False

            user.delete_me()

            self.sesh_redis.delete(temp_key)

            # delete temp dir on next pass
            return True

        # no user session, remove temp dir and everything in it
        else:
            try:
                logger.debug('TempChecker: Deleted expired temp dir: ' + temp_dir)
                shutil.rmtree(temp_dir)
            except Exception as e:
                logger.warn(str(e))
                return False

        return True

    def remove_empty_user_dir(self, warc_dir):
        try:
            # just in case, only remove empty  dir if it hasn't changed in a bit
            if (time.time() - os.path.getmtime(warc_dir)) < self.USER_DIR_IDLE_TIME:
                return False

            os.rmdir(warc_dir)
            logger.debug('TempChecker: Removed Empty User Dir: ' + warc_dir)
            return True
        except Exception as e:
            return False

    def __call__(self):
        temps_to_remove = set()

        # check all warc dirs
        for dir_name in os.listdir(self.record_root_dir):
            if dir_name.startswith('.'):
                continue

            warc_dir = os.path.join(self.record_root_dir, dir_name)

            if not os.path.isdir(warc_dir):
                continue

            # delete old empty user dirs as well
            if not dir_name.startswith(self.temp_prefix):
                self.remove_empty_user_dir(warc_dir)
                continue

            # not yet removed, need to delete contents
            temp_user = warc_dir.rsplit(os.path.sep, 1)[1]

            temps_to_remove.add((temp_user, warc_dir))

        temp_match = User.INFO_KEY.format(user=self.temp_prefix + '*')

        #print('Temp Key Check')

        for redis_key in self.data_redis.scan_iter(match=temp_match, count=100):
            temp_user = redis_key.rsplit(':', 2)[1]

            if temp_user not in temps_to_remove:
                temps_to_remove.add((temp_user, os.path.join(self.record_root_dir, temp_user)))

        logger.debug('TempChecker: Temp Users to Remove: {0}'.format(len(temps_to_remove)))

        # remove if expired
        for temp_user, temp_dir in temps_to_remove:
            self.delete_if_expired(temp_user, temp_dir)

        self.delete_expired_external()

    def delete_expired_external(self):
        """ Delete any expired external collections in non-temp users
        """
        all_ext_templ = Collection.EXTERNAL_KEY.format(coll='*')

        for ext_key in self.data_redis.scan_iter(all_ext_templ):
            try:
                _, coll, _2 = ext_key.split(':', 2)

                collection = Collection(my_id=coll,
                                        redis=self.data_redis,
                                        access=BaseAccess())

                user = collection.get_owner()
                if not user or user.is_anon():
                    continue

                if not collection.has_cdxj():
                    logger.debug('TempChecker: Delete Expired External Coll: ' + collection.name)
                    user.remove_collection(collection, delete=True)
            except Exception:
                import traceback
                traceback.print_exc()


# =============================================================================
if __name__ == "__main__":
    from webrecorder.rec.worker import Worker
    Worker(TempChecker).run()

