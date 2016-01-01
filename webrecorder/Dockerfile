#Dockerfile for webrecorder
FROM python:2.7.11
#FROM ikreymer/pywb:dev

#COPY ./keys /keys

WORKDIR /code

ADD requirements.txt /code/

RUN pip install -r requirements.txt

ENV PYWB_VERSION -e git+https://github.com/ikreymer/pywb.git@master#egg=pywb-0.11.1

RUN pip install $PYWB_VERSION

#WORKDIR /webarchive

COPY . /code/

#COPY ./templates ./templates
#COPY ./static ./static

# Expose as VOLUMEs for nginx access
VOLUME /usr/local/lib/python2.7/site-packages/pywb/static/ /code/static
VOLUME /code/static
