#Dockerfile for webrecorder
FROM webrecorder/webrecore:latest

WORKDIR /build
ADD requirements.txt /build/

USER root
RUN pip install -r requirements.txt

USER apprun

VOLUME /data/

# Expose as VOLUMEs for nginx access
VOLUME /usr/local/lib/python3.5/site-packages/pywb/
VOLUME /code/


WORKDIR /code/

