FROM debian:jessie-slim

RUN apt-get update && \
    apt-get install -yqq tor torsocks wget

RUN sed -i 's/#SocksPort 9050/SocksPort 0.0.0.0:9050/g' /etc/tor/torrc

CMD tor -f /etc/tor/torrc 

 
