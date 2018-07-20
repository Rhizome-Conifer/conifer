#!/bin/sh

CURR_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

pip install pyinstaller

pushd .
cd $CURR_DIR

pyinstaller --clean --additional-hooks-dir ./hooks/ -y -F ./webrecorder_full.py

popd


