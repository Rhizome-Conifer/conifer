#!/bin/sh
python test/api/v1.py &
uwsgi uwsgi.ini