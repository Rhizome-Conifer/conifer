#    OpenDACHS 1.0
#    Copyright (C) 2018
#
#    This program is free software: you can redistribute it and/or modify
#    it under the terms of the GNU General Public License as published by
#    the Free Software Foundation, either version 3 of the License, or
#    (at your option) any later version.
#
#    This program is distributed in the hope that it will be useful,
#    but WITHOUT ANY WARRANTY; without even the implied warranty of
#    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
#    GNU General Public License for more details.
#
#    You should have received a copy of the GNU General Public License
#    along with this program.  If not, see <http://www.gnu.org/licenses/>.


"""
:synopsis: Webrecorder API
(based on admin.py, uploadcontroller.py and utils.py by Ilya Kreymer).
"""


# standard library imports
import os
import re
import json
import time
import base64
import argparse
import tempfile
from datetime import datetime


# third party imports
import requests
from warcio.archiveiterator import ArchiveIterator
from warcio.limitreader import LimitReader
from pywb.warcserver.index.cdxobject import CDXObject
from webrecorder.utils import redis_pipeline
from webrecorder.redisman import init_manager_for_cli

# library specific imports


UPLOAD_KEY = "u:{user}:upl:{upid}"
CDXJ_KEY = "r:{user}:{coll}:{rec}:cdxj"
URL = (
    "http://recorder:8010/record/$upload?"
    "param.user={user}&param.coll{coll}&"
    "param.rec={rec}&"
    "put_record=stream&"
    "param.upid={upid}"
)
EMPTY_DIGEST = '3I42H3S6NNFQ2MSVX7XZKYAYSCX5QBYJ'


def sanitize(string):
    """Sanitize string.

    :param str string: string

    :returns: sanitized string
    :rtype: str
    """
    try:
        alpha_num = re.compile(r"[^\w-]")
        reserved = re.compile(r"^([\d]+([\w]{2}_)?|([\w]{2}_))$")
        string = string.lower().strip()
        string = string.replace(" ", "-")
        string = alpha_num.sub("", string)
        if reserved.match(string):
            string += "-"
    except Exception as exception:
        msg = "failed to sanitize string\t: {}".format(exception)
        raise RuntimeError(msg)
    return string


def _parse_warcinfo(record):
    """Parse WARC info.

    :param record: record

    :returns: WARC info
    :rtype: dict
    """
    try:
        warcinfo = {}
        tmp = record.raw_stream.read(record.length).decode("utf-8")
        for line in tmp.rstrip().split(sep="\n"):
            k, v = tuple(line.split(sep=":", maxsplit=1))
            if k == "json-metadata":
                warcinfo[k] = json.loads(v)
            else:
                warcinfo[k] = v.strip()
    except Exception as exception:
        msg = "failed to parse WARC info\t: {}".format(exception)
        raise RuntimeError(msg)
    if "json-metadata" in warcinfo:
        return warcinfo
    else:
        return {}


def _parse_warc(fp, size):
    """Parse WARC archive.

    :param fp: file object
    :param int size: file size

    :returns: WARC archive information
    :rtype: list
    """
    try:
        info = []
        archive_iterator = ArchiveIterator(fp, no_record_parse=True)
        warcinfo = {}
        metadata = {}
        first = True
        for record in archive_iterator:
            if record.rec_type == "warcinfo":
                warcinfo = _parse_warcinfo(record)
            archive_iterator.read_to_end(record)
            if warcinfo:
                if metadata and metadata.get("offset"):
                    metadata["length"] = (
                        archive_iterator.member_info[0] - metadata["offset"]
                    )
                    info.append(metadata)
                metadata = warcinfo.get("json-metadata")
                if "title" not in metadata:
                    metadata["title"] = "Uploaded record"
                if "type" not in metadata:
                    metadata["type"] = "recording"
            elif first:
                metadata = {
                    "title": "Uploaded record",
                    "type": "recording",
                    "offset": 0
                }
            first = False
        if metadata and metadata.get("offset") >= 0:
            metadata["length"] = (fp.tell() - metadata["offset"])
            info.append(metadata)
        if fp.tell() < size:
            while True:
                buf = fp.read(size=8192)
                if not buf:
                    break
    except Exception as exception:
        msg = "failed to parse WARC archive\t: {}".format(exception)
        raise RuntimeError(msg)
    return info


def _get_archive(username, collection, info):
    """Get archive.

    :param str username: username
    :param dict collection: collection
    :param list info: WARC info

    :returns: archive
    :rtype: tuple
    """
    try:
        manager = init_manager_for_cli()
        records = []
        for metadata in info:
            if metadata["type"] == "recording":
                recording = manager.create_recording(
                    username,
                    collection["id"],
                    sanitize(metadata["title"]),
                    metadata["title"],
                    collection["title"],
                    rec_type=metadata.get("rec_type"),
                    ra_list=metadata.get("ra")
                )
                records.append(
                    {
                        "coll": collection["id"],
                        "rec": recording["id"],
                        "offset": metadata["offset"],
                        "length": metadata["length"],
                        "pages": metadata.get("pages")
                    }
                )
                manager.set_recording_timestamps(
                    username,
                    collection["id"],
                    recording["id"],
                    metadata.get("created_at"),
                    metadata.get("updated at")
                )
    except Exception as exception:
        msg = "failed to get archive\t: {}".format(exception)
        raise RuntimeError(msg)
    return (collection, records)


def _put(key, fp, username, coll, rec, offset, length):
    """Make PUT request.

    :param str key: key
    :param fp: file object
    :param str username: username
    :param str coll: collection ID
    :param str rec: record ID
    :param int offset: offset
    :param int length: length
    """
    try:
        fp.seek(offset)
        limit_reader = LimitReader(fp, length)
        headers = {"Content-Length": str(length)}
        url = URL.format(
            record_host="http://recorder:8010",
            user=username,
            coll=coll,
            rec=rec,
            upid=key
        )
        requests.put(url, headers=headers, data=limit_reader)
    except Exception as exception:
        msg = "failed to make PUT request\t: {}".format(exception)
        raise RuntimeError(msg)
    return


def _is_page(cdxobject):
    """Determine whether the CDX line is a page.

    :param CDXObject cdxobject: CDX line

    :returns: whether the CDX line is a page
    :rtype: bool
    """
    try:
        url = cdxobject["url"]
        toggle = (
            url.startswith("http://", "https://") and
            not url.endswith("robots.txt")
        )
        if toggle:
            status = cdxobject.get("status")
            if not status or status == "200":
                mime = cdxobject["mime"]
                digest = cdxobject["digest"]
                if (
                        status and
                        mime in ["text/html", "text/plain"] and
                        digest != EMPTY_DIGEST
                ):
                    splits = url.split(sep="?", maxsplit=1)
                    if len(splits) > 1 and len(splits[1]) > len(splits[0]):
                        toggle = False
            else:
                toggle = False
    except Exception as exception:
        msg = "failed to determine whether the CDX line is a page\t: {}"
        raise RuntimeError(msg.format(exception))
    return toggle


def _find_pages(username, coll, rec):
    """Find pages.

    :param str username: username
    :param str coll: collection ID
    :param str rec: record ID

    :returns: pages
    :rtype: list
    """
    try:
        manager = init_manager_for_cli()
        key = CDXJ_KEY.format(user=username, coll=coll, rec=rec)
        pages = []
        for value in manager.redis.zrange(key, 0, -1):
            cdxobject = CDXObject(value.encode("udf-8"))
            if _is_page(cdxobject):
                pages.append(
                    {
                        "url": cdxobject["url"],
                        "title": cdxobject["url"],
                        "timestamp": cdxobject["timestamp"]
                    }
                )
    except Exception as exception:
        msg = "failed to find pages\t: {}".format(exception)
        raise RuntimeError(msg)
    return pages


def _run(key, fp, username, records, total_size):
    """Run.

    :param str key: Redis key
    :param fp: file object
    :param str username: username
    :param list records: records
    :param int total_size: total size
    """
    try:
        manager = init_manager_for_cli()
        curr = 0
        for record in records:
            if record["length"] > 0:
                _put(
                    key,
                    fp,
                    username,
                    record["coll"],
                    record["rec"],
                    record["offset"],
                    record["length"]
                )
            pages = record.get("pages")
            raise SystemExit(record)
            if not pages:
                pages = _find_pages(username, record["coll"], record["rec"])
            if pages:
                manager.import_pages(
                    username, record["coll"], record["rec"], pages
                )
            delta = record["offset"] - curr
            curr = record["offset"] + record["length"]
            if delta > 0:
                manager.redis.hincrby(key, "size", delta*2)
    except Exception as exception:
        msg = "failed to run\t: {}".format(exception)
        raise RuntimeError(msg)
    finally:
        delta = fp.tell() - total_size
        fp.close()
        if delta > 0:
            manager.redis.hincrby(key, "size", delta*2)
        with redis_pipeline(manager.redis) as pipeline:
            pipeline.hincrby(key, "files", -1)
            pipeline.hset(key, "done", 1)
    return


def _upload(fp, key, info, filename, username, collection, total_size):
    """Upload file.

    :param fp: file object
    :param str key: Redis key
    :param list info: WARC info
    :param str filename: filename
    :param str username: username
    :param dict collection: collection
    :param int total_size: total size
    """
    try:
        manager = init_manager_for_cli()
        archive = _get_archive(username, collection, info)
        with redis_pipeline(manager.redis) as pipeline:
            pipeline.hset(key, "coll", archive[0]["id"])
            pipeline.hset(key, "coll_title", archive[0]["title"])
            pipeline.hset(key, "filename", filename)
        if not archive[1]:
            raise ValueError("empty archive")
        _run(key, fp, username, archive[1], total_size)
    except Exception as exception:
        msg = "failed to upload WARC archive\t: {}".format(exception)
        raise RuntimeError(msg)
    return


def upload(username, filename, collection):
    """Upload file.

    :param str username: username
    :param str filename: filename
    :param dict collection: collection
    """
    try:
        manager = init_manager_for_cli()
        size = os.path.getsize(filename)
        if size == 0:
            raise RuntimeError("failed to upload file\t: file size is 0")
        else:
            if size > manager.get_size_remaining(username):
                msg = "failed to upload file\t: exceeds maximum file size"
                raise RuntimeError(msg)
        tmp = tempfile.SpooledTemporaryFile(max_size=16384*8)
        fp = open(filename, mode="rb")
        info = _parse_warc(fp, size)
        total_size = tmp.tell()
        id_ = base64.b32encode(os.urandom(5)).decode("utf-8")
        key = UPLOAD_KEY.format(user=username, upid=id_)
        with redis_pipeline(manager.redis) as pipeline:
            pipeline.hset(key, "size", 0)
            pipeline.hset(key, "total_size", total_size*2)
            pipeline.hset(key, "filename", filename)
            pipeline.hset(key, "total_files", 1)
            pipeline.hset(key, "files", 1)
        _upload(fp, key, info, filename, username, collection, total_size)
    except RuntimeError:
        raise
    except Exception as exception:
        msg = "failed to upload file\t: {}".format(exception)
        raise RuntimeError(msg)
    finally:
        if "fp" in locals():
            fp.close()
    return


def create_user(
        username, password, email_addr, filename,
        role="opendachs", desc='{"name": "Ticket"}'
):
    """Create user.

    :param str username: username
    :param str password: password
    :param str email_addr: email address
    :param str role: role
    :param str desc: user account description
    """
    try:
        manager = init_manager_for_cli()
        users = manager.get_users()
        if (
                not manager.USER_RX.match(username) or
                username in manager.RESTRICTED_NAMES
        ):
            raise ValueError("invalid username {}".format(username))
        elif username in users:
            raise ValueError("username {} already exists".format(username))
        roles = [role[0] for role in manager.cork.list_roles()]
        if role not in roles:
            raise ValueError("invalid role {}".format(role))
        if not manager.PASS_RX.match(password):
            raise ValueError("invalid password")
        manager.cork._store.users[username] = {
            "role": role,
            "hash": manager.cork._hash(username, password).decode("ascii"),
            "email_addr": email_addr,
            "desc": desc,
            "creation_date": str(datetime.utcnow()),
            "last_login": str(datetime.utcnow())
        }
        manager.cork._store.save_users()
        key = manager.user_key.format(user=username)
        with redis_pipeline(manager.redis) as pipeline:
            pipeline.hset(key, "max_size", manager.default_max_size)
            pipeline.hset(key, "max_coll", 1)
            pipeline.hset(key, "created_at", int(time.time()))
            pipeline.hset(key, "name", "Ticket")
            pipeline.hsetnx(key, "size", 0)
        collection = manager.create_collection(
            username,
            coll=manager.default_coll["id"],
            coll_title=manager.default_coll["title"],
            desc=manager.default_coll["desc"].format(username),
            public=False
        )
        upload(username, filename, collection)
    except Exception as exception:
        raise RuntimeError("failed to create user\t: {}".format(exception))
    return


def delete_user(username):
    """Delete user.

    :param str username: username
    """
    try:
        manager = init_manager_for_cli()
        users = manager.get_users()
        if username not in users:
            raise ValueError("username {} does not exist".format(username))
        dest = manager._send_delete("user", username)
        if dest:
            manager.cork.user(username).delete()
    except Exception as exception:
        raise RuntimeError("failed to delete user\t: {}".format(exception))
    return


def get_argument_parser():
    """Get argument parser.

    :returns: argument parser
    :rtype: ArgumentParser
    """
    try:
        argument_parser = argparse.ArgumentParser()
        subparsers = argument_parser.add_subparsers(dest="subparser")
        create = subparsers.add_parser("create", help="create user")
        create.add_argument("username", help="username")
        create.add_argument("password", help="password")
        create.add_argument("email_addr", help="email address")
        create.add_argument("filename", help="filename")
        create.add_argument("--role", default="opendachs", help="role")
        create.add_argument(
            "--desc",
            default="OpenDACHS ticket account", help="user account description"
        )
        delete = subparsers.add_parser("delete", help="delete user")
        delete.add_argument("username", help="username")
    except Exception as exception:
        msg = "failed to get argument parser\t: {}"
        raise RuntimeError(msg.format(exception))
    return argument_parser


def main():
    """main function."""
    try:
        argument_parser = get_argument_parser()
        args = argument_parser.parse_args()
        if args.subparser == "create":
            create_user(
                args.username, args.password, args.email_addr, args.filename,
                role=args.role, desc=args.desc
            )
        elif args.subparser == "delete":
            delete_user(args.username)
    except Exception as exception:
        msg = "failed to execute main function\t: {}"
        raise RuntimeError(msg.format(exception))
    return


if __name__ == "__main__":
    main()
