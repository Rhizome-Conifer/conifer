FROM python:3.5.2
MAINTAINER Ilya Kreymer <ikreymer at gmail.com>

WORKDIR /app

ADD requirements.txt /app/

RUN pip install -r requirements.txt

ADD main.py /app/
ADD dockercontroller.py /app/
ADD uwsgi.ini /app/
ADD . /app/

VOLUME /app/static/

CMD ["uwsgi", "uwsgi.ini"]

