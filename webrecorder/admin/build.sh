#!/usr/bin/env bash
# Run admin build on `/code/` volume.

CURR_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
docker run -v $CURR_DIR:/code -it -w /code/ node bash -c "yarn install; npm run build"
