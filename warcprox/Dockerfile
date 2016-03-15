FROM python:3.5

WORKDIR /reqs

ADD requirements.txt /reqs/

RUN pip install -U -r requirements.txt

RUN pip install -U -e git+https://github.com/ikreymer/warcprox.git@master#egg=warcprox-1.4

ENV PYWB_VERSION -e git+https://github.com/ikreymer/pywb.git@develop#egg=pywb-0.30.0-develop

RUN pip install $PYWB_VERSION

ADD run-rec.sh /reqs/
RUN chmod +x /reqs/run-rec.sh

