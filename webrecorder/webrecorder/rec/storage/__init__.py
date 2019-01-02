from webrecorder.rec.storage.s3 import S3Storage
from webrecorder.rec.storage.local import LocalFileStorage


def get_storage(storage_type, redis):
    """Return Webrecorder storage.

    :param str storage_type: type of storage
    :param StrictRedis redis: Redis interface

    :returns: Webrecorder storage or None
    :rtype: BaseStorage or None
    """
    if storage_type == 'local':
        return LocalFileStorage(redis)

    elif storage_type == 's3':
        return S3Storage()

    else:
        return None

