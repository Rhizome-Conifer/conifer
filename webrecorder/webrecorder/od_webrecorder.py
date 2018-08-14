#    OpenDACHS 1.0
#    Copyright (C) 2018  Carine Dengler
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
:synopsis: Webrecorder API (based on admin.py).
"""


# standard library imports
import time
import argparse
from datetime import datetime

# third party imports
from webrecorder.utils import redis_pipeline
from webrecorder.redisman import init_manager_for_cli

# library specific imports


def create_user(
        username, password, email_addr,
        role="opendachs", desc="OpenDACHS ticket account"
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
        max_size = manager.redis.hmget(
            "h:defaults", ["max_size"]
        )
        with redis_pipeline(manager.redis) as pipeline:
            pipeline.hset(key, "max_size", max_size)
            pipeline.hset(key, "max_coll", 1)
            pipeline.hset(key, "created_at", int(time.time()))
            pipeline.hset(key, "name", "OpenDACHS ticket")
            pipeline.hsetnx(key, "size", 0)
        manager.create_collection(
            username,
            coll=manager.default_coll["id"],
            coll_title=manager.default_coll["title"],
            desc=manager.default_coll["desc"].format(username),
            public=False
        )
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
                args.username, args.password, args.email_addr,
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
