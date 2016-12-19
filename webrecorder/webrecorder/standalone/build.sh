#!/bin/sh

pyinstaller --clean --additional-hooks-dir ./hooks/ -y -F ./standalone.py
