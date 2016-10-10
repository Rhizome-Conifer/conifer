FROM webrecorder/proxy

ADD banner.html /code/banner.html

ADD mitmdump.conf /home/apprun/.mitmproxy/mitmdump.conf

#CMD mitmdump -p 8080 --ignore ocsp.digicert.com --ignore '^(.+\.)?mozilla\.(net|com)' --websockets --no-upstream-cert --no-http2 -s "/code/run.py --host http://webagg:8080/ --magic-fwd http://webrecorder_nginx_1 --redis redis://redis:6379/0"

CMD mitmdump -s "/code/run.py --host http://webagg:8080/ --magic-fwd http://webrecorder_nginx_1 --redis redis://redis:6379/0"

