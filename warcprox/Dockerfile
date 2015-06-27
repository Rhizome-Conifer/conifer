FROM python:2.7

WORKDIR /reqs

ADD requirements.txt /reqs/

RUN pip install -r requirements.txt

ADD run-rec.sh /reqs/
RUN chmod +x /reqs/run-rec.sh

