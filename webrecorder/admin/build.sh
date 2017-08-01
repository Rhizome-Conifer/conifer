#!/usr/bin/env bash
# Run admin build on `/code/` volume.

docker run -v $PWD:/code -it -w /code/ node bash -c "yarn install; npm run build"
