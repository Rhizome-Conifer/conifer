FROM python:2.7

COPY ./keys /keys

WORKDIR /code

ADD requirements.txt /code/

RUN pip install -r requirements.txt

ADD . /code/

COPY ./static ./keys
COPY ./templates ./templates

VOLUME /archives
