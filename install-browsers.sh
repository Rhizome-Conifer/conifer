#!/bin/sh

# This script pulls all of the available remote browsers
# Browsers can be installed individually if installing all of the browsers is not desired.

# Chrome
docker pull oldwebtoday/chrome:53
docker pull oldwebtoday/chrome:60

# Firefox
docker pull oldwebtoday/firefox:49
docker pull oldwebtoday/firefox:56
docker pull oldwebtoday/firefox:57

