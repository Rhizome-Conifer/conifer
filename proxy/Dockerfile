FROM webrecorder/proxy

ADD banner.html /code/banner.html
ADD error.html /code/error.html
ADD head_insert.html /code/head_insert.html
ADD proxy_assets.yaml /code/proxy_assets.yaml

ADD config.yaml /home/archivist/.mitmproxy/config.yaml

CMD mitmdump --no-upstream-cert -s "/code/run.py --host http://webagg:8080/ --assets-path proxy_assets.yaml --proxy-magic webrecorder.io --magic-fwd http://webrecorder_nginx_1 --redis ${REDIS_BROWSER_URL:-redis://redis:6379/0}"

