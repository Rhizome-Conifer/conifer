#!/bin/bash

if [ -n "$REDIS_MASTER" ]; then
    sed -i "s/^# slaveof\(.*\)$/slaveof $REDIS_MASTER 6379/" /etc/redis/redis.conf
fi

redis-server /etc/redis/redis.conf

