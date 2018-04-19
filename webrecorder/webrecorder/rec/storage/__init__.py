from webrecorder.rec.storage.s3 import S3Storage
from webrecorder.rec.storage.local import LocalFileStorage


def get_storage(storage_type, redis):
    if storage_type == 'local':
        return LocalFileStorage(redis)

    elif storage_type == 's3':
        return S3Storage()

    else:
        return None

