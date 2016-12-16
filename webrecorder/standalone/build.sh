#!/bin/sh

pyinstaller --clean --additional-hooks-dir ./hooks/ -w -y -F ./standalone.py
