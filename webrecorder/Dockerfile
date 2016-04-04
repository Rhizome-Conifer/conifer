#Dockerfile for webrecorder
FROM webrecorder/webrecore
#FROM ikreymer/pywb:dev

#COPY ./keys /keys

WORKDIR /build
USER root
ADD requirements.txt /build/

RUN pip install -r requirements.txt

#ENV PYWB_VERSION -e git+https://github.com/ikreymer/pywb.git@develop#egg=pywb-0.30-develop

#RUN pip install $PYWB_VERSION

#WORKDIR /webarchive

#COPY . /code/

#COPY ./templates ./templates
#COPY ./static ./static

# Expose as VOLUMEs for nginx access
VOLUME /usr/local/lib/python3.5/site-packages/pywb/
VOLUME /code/

WORKDIR /code/
CMD uwsgi uwsgi.ini


