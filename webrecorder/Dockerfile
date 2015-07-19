#Dockerfile for webrecorder
FROM python:2.7

COPY ./keys /keys

WORKDIR /code

ADD requirements.txt /code/

RUN pip install -U -r requirements.txt

ADD . /code/

COPY ./templates ./templates
COPY ./static ./static

# Expose as VOLUMEs for nginx access
#VOLUME /usr/local/lib/python2.7/site-packages/pywb/static/ /code/static
#VOLUME /code/static

EXPOSE 8081
