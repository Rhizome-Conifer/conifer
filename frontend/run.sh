#!/bin/bash

if [ "$NODE_ENV" = "production" ]
then
    echo "running production build"
    yarn run prod;
else
    echo "running development build"
    yarn run dev;
fi