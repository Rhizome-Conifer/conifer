#!/bin/bash
# redeploy just webrecorder and nginx
docker-compose stop webrecorder;
docker-compose build webrecorder;
docker-compose up -d --no-deps webrecorder nginx
