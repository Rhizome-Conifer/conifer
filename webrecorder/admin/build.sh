#!/bin/bash
# Run admin build on `/code/` volume.

docker run -v $PWD:/code -it -w /code/ node bash -c "npm install; npm run build"