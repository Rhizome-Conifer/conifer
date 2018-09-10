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
import os
import argparse

# third party imports
import redis

# library specific imports
import webrecorder.utils
import webrecorder.webreccork
import webrecorder.models.base
import webrecorder.models.usermanager


def get_user_manager():
    """Get user manager.

    :returns: user manager
    :rtype: UserManager
    """
    try:
        redis_base_url = os.environ["REDIS_BASE_URL"]
        redis = redis.StrictRedis.from_url(
            redis_base_url, decode_responses=True
        )
        config = webrecorder.utils.load_wr_config()
        cork = webrecorder.webreccork.WebRecCork.create_cork(redis, config)
        user_manager = webrecorder.models.usermanager.UserManager(
            redis, cork, config
        )
        user_manager.access = webrecorder.models.base.BaseAccess()
    except Exception as exception:
        msg = "failed to get user manager:{}".format(exception)
        raise RuntimeError(msg)
    return user_manager


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
        err, _ = user_manager.create_user_as_admin(
            email_addr, username, password, password, role, desc
        )
        if err is not None:
            msg = "failed to create user:{}".format(" AND ".join(err))
            raise RuntimeError(msg)
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
        create.add_argument("password", help="password")
        create.add_argument("email_addr", help="email address")
        create.add_argument("role", help="role")
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
