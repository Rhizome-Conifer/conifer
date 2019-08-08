#!/usr/bin/env bash

CURR_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )

target=$CURR_DIR/wr.env
sample=$CURR_DIR/webrecorder/webrecorder/config/wr_sample.env

if [ -e "$target" ]; then
   echo "$target already exists.. exiting to avoid overriding current settings"
   exit 1
fi

cp "$sample" "$target"

function set_key {
    key=$(python -c "import os; import base64; print(base64.b32encode(os.urandom(75)))")
    sed -i'' -e "s/$1=.*/$1=$key/g" "$target"
}

set_key "SECRET_KEY"
set_key "ENCRYPT_KEY"
set_key "VALIDATE_KEY"

mkdir "$CURR_DIR/data"
mkdir "$CURR_DIR/data/warcs/"

