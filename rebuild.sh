#!/bin/bash
# redeploy just webrecorder and nginx
docker-compose build app;
docker-compose stop app;
docker-compose stop nginx;

docker-compose up -d --no-deps app nginx
