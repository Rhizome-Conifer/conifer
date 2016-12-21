#!/bin/sh

CURR_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

pushd .
cd $CURR_DIR

pyinstaller --clean --additional-hooks-dir ./hooks/ -y -F ./standalone.py

popd


