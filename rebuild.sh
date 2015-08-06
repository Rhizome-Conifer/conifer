#!/bin/bash
# redeploy just webrecorder and nginx
docker-compose build webrecorder;
docker-compose stop webrecorder;
docker-compose up -d --no-deps webrecorder nginx
