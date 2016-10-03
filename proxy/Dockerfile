FROM webrecorder/proxy

ADD banner.html /code/banner.html

CMD mitmdump -p 8080 --websockets --no-upstream-cert --no-http2 -s "/code/run.py --host http://webagg:8080/ --magic-fwd http://webrecorder_nginx_1 --redis redis://redis:6379/0"


