import redis
import os
import json
import glob
import requests
import shutil
import time
import errno

from webrecorder.models import User, Collection
from webrecorder.models.base import BaseAccess

import logging
logger = logging.getLogger('wr.io')


# ============================================================================
class TempChecker(object):
    """
    TempChecker is responsible for deleting temporary users and for cleaning up
    files and directories in `self.record_root_dir` when they are no longer
    needed. It is designed to be run by uWSGI on a regular schedule.

    When called, it:
    a) Compiles a list of all temporary users, both derived from the directory
    structure of `self.record_root_dir` and retrieved from Redis;
    b) Deletes any temporary users whose sessions have expired, marks all
    their recording sessions closed, and signals that their collections
    should be deleted;
    c) Deletes directories belonging to expired temporary users (generally
    already emptied due to the signals emitted by b);
    d) Deletes all other empty directories in `self.record_root_dir`, provided
    they haven't been altered within the configured duration, including
    temp dirs from permanent users' already-committed recording sessions; and
    e) Cleans up any extraneous sessions.
    """
    USER_DIR_IDLE_TIME = 1800

    def __init__(self, config):
        super(TempChecker, self).__init__()

        self.data_redis = redis.StrictRedis.from_url(os.environ['REDIS_BASE_URL'],
                                                     decode_responses=True)

        self.sesh_redis = redis.StrictRedis.from_url(os.environ['REDIS_SESSION_URL'],
                                                     decode_responses=True)

        self.USER_DIR_IDLE_TIME = config['coll_cdxj_ttl']

        self.temp_prefix = config['temp_prefix']
        self.record_root_dir = os.environ['RECORD_ROOT']
        self.sesh_key_template = config['session.key_template']

        # ensure record_root_dir exists here!
        os.makedirs(self.record_root_dir, exist_ok=True)

        logger.info('Temp Check Root: ' + self.record_root_dir)

    def delete_if_expired(self, temp_user, temp_dir):
        temp_key = 't:' + temp_user
        sesh = self.sesh_redis.get(temp_key)

        if sesh == 'commit-wait':
            # This temporary user has signed up for a permanent account and
            # their collections will be migrated to storage.
            # Clean up if that migration is complete (i.e. the dir is empty).
            # Otherwise, wait.
            if os.path.isdir(temp_dir):
                try:
                    logger.debug('TempChecker: Removing if empty: ' + temp_dir)
                    os.rmdir(temp_dir)
                    logger.debug('TempChecker: Deleted empty dir: ' + temp_dir)
                except OSError as e:
                    if e.errno == errno.ENOTEMPTY:
                        logger.debug('TempChecker: Waiting for commit')
                    elif e.errno != errno.ENOENT:
                        logger.error(str(e))
                    return False
            else:
                logger.debug('TempChecker: Removing Session For Already Deleted Dir: ' + temp_dir)

            self.sesh_redis.delete(temp_key)
            return True

        # temp user key exists
        elif self.data_redis.exists(User.INFO_KEY.format(user=temp_user)):

            # if user still active, don't remove
            if self.sesh_redis.get(self.sesh_key_template.format(sesh)):
                return False

            logger.debug('TempChecker: Deleting expired user: ' + temp_user)

            user = User(my_id=temp_user,
                        redis=self.data_redis,
                        access=BaseAccess())

            # mark the user's open recordings "closed";
            # return (if necessary) to give time for closing logic to complete
            wait_to_delete = False
            for collection in user.get_collections(load=False):
                for recording in collection.get_recordings(load=False):
                    if recording.is_open(extend=False):
                        recording.set_closed()
                        logger.debug('TempChecker: Closing temp recording: ' + recording.my_id)
                        wait_to_delete = True
            if wait_to_delete:
                return False

            # delete the user; signal that the user's collections should be deleted.
            # the temp dir containing those collections will be deleted on next pass.
            user.delete_me()

            # delete the session
            self.sesh_redis.delete(temp_key)

            return True

        # no user session, remove temp dir and everything in it
        else:
            try:
                logger.debug('TempChecker: Deleted expired temp dir: ' + temp_dir)
                shutil.rmtree(temp_dir)
            except OSError as e:
                if e.errno != errno.ENOENT:
                    logger.error(str(e))
                return False

        return True

    def remove_empty_user_dir(self, warc_dir):
        # just in case, only remove empty  dir if it hasn't changed in a bit
        if (time.time() - os.path.getmtime(warc_dir)) < self.USER_DIR_IDLE_TIME:
            return False

        try:
            os.rmdir(warc_dir)
            logger.debug('TempChecker: Removed Empty User Dir: ' + warc_dir)
            return True
        except OSError as e:
            if e.errno not in [errno.ENOENT, errno.ENOTEMPTY]:
                logger.error(str(e))
            return False

    def __call__(self):
        all_temps = set()

        # scan self.record_root_dir for temporary and unneeded dirs
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

            temp_user = warc_dir.rsplit(os.path.sep, 1)[1]
            all_temps.add((temp_user, warc_dir))

        # include any temp users in redis that were missed during the directory scan
        temp_match = User.INFO_KEY.format(user=self.temp_prefix + '*')
        for redis_key in self.data_redis.scan_iter(match=temp_match, count=100):
            temp_user = redis_key.rsplit(':', 2)[1]

            if temp_user not in all_temps:
                all_temps.add((temp_user, os.path.join(self.record_root_dir, temp_user)))

        logger.debug('TempChecker: Temp User Count: {0}'.format(len(all_temps)))

        # remove if expired
        for temp_user, temp_dir in all_temps:
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

