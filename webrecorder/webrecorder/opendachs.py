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
:synopsis: Webrecorder API.
"""


# standard library imports
import re
import os
import base64
import argparse

# third party imports
import redis

# library specific imports
import webrecorder.utils
import webrecorder.webreccork
import webrecorder.models.base
import webrecorder.models.importer
import webrecorder.models.usermanager
import webrecorder.rec.webrecrecorder


class ODUserManager(webrecorder.models.usermanager.UserManager):
    """OpenDACHS user manager."""

    USER_RX = re.compile(r"[0-9A-Za-z]{8}")

    def __init__(self, redis_interface, cork, config):
        self.base_access = webrecorder.models.base.BaseAccess()
        super().__init__(redis_interface, cork, config)
        return

    def _get_access(self):
        return self.base_access


def get_redis_interface():
    """Get Redis interface.

    :returns: Redis interface
    :rtype: StrictRedis
    """
    try:
        redis_base_url = os.environ["REDIS_BASE_URL"]
        redis_interface = redis.StrictRedis.from_url(
            redis_base_url, decode_responses=True
        )
    except Exception as exception:
        msg = "failed to get Redis interface:{}".format(exception)
        raise RuntimeError(msg)
    return redis_interface


def get_user_manager():
    """Get user manager.

    :returns: user manager
    :rtype: UserManager
    """
    try:
        redis_interface = get_redis_interface()
        config = webrecorder.utils.load_wr_config()
        cork = webrecorder.webreccork.WebRecCork.create_cork(
            redis_interface, config
        )
        user_manager = ODUserManager(
            redis_interface, cork, config
        )
    except Exception as exception:
        msg = "failed to get user manager:{}".format(exception)
        raise RuntimeError(msg)
    return user_manager


def get_upload_id():
    """Get upload ID.

    :returns: upload ID
    :rtype: str
    """
    try:
        upload_id = base64.b32encode(os.urandom(5)).decode("utf-8")
    except Exception as exception:
        msg = "failed to get upload ID:{}".format(exception)
        raise RuntimeError(msg)
    return upload_id


def import_warc(filename, user):
    """Import WARC archive.

    :param str filename: filename
    :param User user: user
    """
    try:
        redis_interface = get_redis_interface()
        config = webrecorder.utils.load_wr_config()
        indexer = (
            webrecorder.rec.webrecrecorder.WebRecRecorder.make_wr_indexer(
                config
            )
        )
        upload_id = get_upload_id()
        inplace_importer = webrecorder.models.importer.InplaceImporter(
            redis_interface, config, user, indexer, upload_id
        )
        inplace_importer.multifile_upload(user, [filename])
    except Exception as exception:
        msg = "failed to import WARC archive:{}".format(exception)
        raise RuntimeError(msg)
    return


def create_user(username, password, email_addr, role, desc, filename):
    """Create user.

    :param str username: username
    :param str password: password
    :param str email_addr: email address
    :param str role: role
    :param str desc: description
    :param str filename: filename
    """
    try:
        user_manager = get_user_manager()
        err, new_user = user_manager.create_user_as_admin(
            email_addr, username, password, password, role, desc
        )
        if err is not None:
            msg = "failed to create user:{}".format(", ".join(err))
            raise RuntimeError(msg)
        if new_user is None:
            msg = "failed to create user"
            raise RuntimeError
        import_warc(filename, new_user[0])
    except RuntimeError:
        raise
    except Exception as exception:
        msg = "failed to create user:{}".format(exception)
        raise RuntimeError(msg)
    return


def delete_user(username):
    """Delete user.

    :param str username: username
    """
    try:
        user_manager = get_user_manager()
        user_manager.delete_user(username)
    except Exception as exception:
        msg = "failed to delete user:{}".format(exception)
        raise RuntimeError(msg)
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
        create.add_argument("role", help="role")
        create.add_argument("password", help="password")
        create.add_argument("email_addr", help="email address")
        create.add_argument("desc", help="description")
        create.add_argument("filename", help="filename")
        delete = subparsers.add_parser("delete", help="delete user")
        delete.add_argument("username", help="username")
    except Exception as exception:
        msg = "failed to get argument parser:{}".format(exception)
        raise RuntimeError(msg)
    return argument_parser


def main():
    """main function."""
    try:
        argument_parser = get_argument_parser()
        args = argument_parser.parse_args()
        if args.subparser == "create":
            create_user(
                args.username, args.password, args.email_addr,
                args.role, args.desc, args.filename
            )
        elif args.subparser == "delete":
            delete_user(args.username)
    except Exception as exception:
        msg = "failed to execute main function:{}".format(exception)
        raise RuntimeError(msg.format(exception))
    return


if __name__ == "__main__":
    main()
