#Dockerfile for webrecorder
FROM python:latest
#FROM ikreymer/pywb:dev

#COPY ./keys /keys

WORKDIR /code

ADD requirements.txt /code/

RUN pip install -r requirements.txt

ENV PYWB_VERSION -e git+https://github.com/ikreymer/pywb.git@develop#egg=pywb-1.0

RUN pip install $PYWB_VERSION

#WORKDIR /webarchive

COPY . /code/

#COPY ./templates ./templates
#COPY ./static ./static

# Expose as VOLUMEs for nginx access
VOLUME /usr/local/lib/python2.7/site-packages/pywb/static/ /code/static
VOLUME /code/static
