FROM webrecorder/proxy:1.1

ADD banner.html /code/banner.html
ADD error.html /code/error.html

ADD mitmdump.conf /home/apprun/.mitmproxy/mitmdump.conf


CMD mitmdump -s "/code/run.py --host http://webagg:8080/ --proxy-magic webrecorder.io --magic-fwd http://webrecorder_nginx_1 --redis redis://redis:6379/0"

