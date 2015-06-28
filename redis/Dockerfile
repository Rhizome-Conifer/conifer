FROM redis:2.8.21

ADD init-redis-conf.sh /

RUN chmod u+x /init-redis-conf.sh

COPY redis.conf /etc/redis/redis.conf

WORKDIR /data

CMD /init-redis-conf.sh

