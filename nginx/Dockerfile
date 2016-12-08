#FROM ubuntu:14.04
FROM debian:jessie

RUN  apt-get update \
  && apt-get install -y wget build-essential libpcre3 libpcre3-dev libssl-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp

ARG VERSION=1.10.2

RUN wget http://nginx.org/download/nginx-${VERSION}.tar.gz

RUN tar xvf nginx-${VERSION}.tar.gz

RUN wget https://github.com/openresty/headers-more-nginx-module/archive/v0.26.tar.gz

RUN tar xvf v0.26.tar.gz

#RUN git clone https://github.com/anomalizer/ngx_aws_auth
RUN wget https://github.com/anomalizer/ngx_aws_auth/archive/1.1.1.tar.gz

RUN tar xvf 1.1.1.tar.gz

RUN ls

WORKDIR /tmp/nginx-${VERSION}

#RUN apt-get install -y libssl-dev

RUN ./configure  --prefix=/etc/nginx --with-http_ssl_module --add-module=/tmp/headers-more-nginx-module-0.26/ --add-module=/tmp/ngx_aws_auth-1.1.1/

RUN make && make install

RUN cp /etc/nginx/sbin/nginx /usr/bin/

COPY nginx.conf /etc/nginx/conf/
COPY webrec.conf /etc/nginx/conf/

RUN mkdir /var/log/nginx

RUN ln -sf /dev/stdout /var/log/nginx/access.log
RUN ln -sf /dev/stderr /var/log/nginx/error.log

#VOLUME /static

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
