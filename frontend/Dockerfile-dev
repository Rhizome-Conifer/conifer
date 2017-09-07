FROM node:8.2.1

RUN useradd --user-group --create-home --shell /bin/false app && mkdir -p /opt/app

ENV HOME=/home/app TERM=xterm APP=/opt/app

# add more arguments from CI to the image so that `$ env` should reveal more info
ARG CI_BUILD_ID
ARG CI_BUILD_REF
ARG CI_REGISTRY_IMAGE
ARG CI_PROJECT_NAME
ARG CI_BUILD_REF_NAME
ARG CI_BUILD_TIME

ENV CI_BUILD_ID=$CI_BUILD_ID CI_BUILD_REF=$CI_BUILD_REF CI_REGISTRY_IMAGE=$CI_REGISTRY_IMAGE \
    CI_PROJECT_NAME=$CI_PROJECT_NAME CI_BUILD_REF_NAME=$CI_BUILD_REF_NAME CI_BUILD_TIME=$CI_BUILD_TIME \
    npm_config_tmp=/tmp


ADD package.json yarn.lock $APP/

RUN chown -R app $APP && chgrp -R app $APP && chown -R app /usr/local

WORKDIR $APP

USER app

RUN npm install --global yarn

# RUN yarn install && yarn upgrade
RUN rm -rf node_modules && yarn install && yarn cache clean && rm -rf ~/tmp/*
