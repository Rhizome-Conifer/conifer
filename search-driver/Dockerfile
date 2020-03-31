FROM node:12.8.0

WORKDIR /app

COPY . /app/
#COPY package.json /app/
#COPY yarn.lock /app/

RUN yarn install

CMD node index.js
