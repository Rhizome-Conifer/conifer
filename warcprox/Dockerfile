FROM python:3.5

WORKDIR /reqs

ADD requirements.txt /reqs/

RUN pip install -U -r requirements.txt

ENV PYWB_VERSION -e git+https://github.com/ikreymer/pywb.git@py3#egg=pywb-1.0

RUN pip install $PYWB_VERSION

ADD run-rec.sh /reqs/
RUN chmod +x /reqs/run-rec.sh

