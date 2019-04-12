#!/bin/sh

# This script pulls all of the available remote browsers, and the remote desktop system
# The remote desktop system containers are required for any browser
# Browsers can be installed individually if installing all of the browsers is not desired.

# Remote Desktop System and Base Browser (Required for all browsers)
docker pull oldwebtoday/vnc-webrtc-audio
docker pull oldwebtoday/base-displayaudio
docker pull oldwebtoday/base-browser

# For automation (works with chrome 67 and up)
docker pull oldwebtoday/autobrowser

# Chrome
docker pull oldwebtoday/chrome:53
docker pull oldwebtoday/chrome:60
docker pull oldwebtoday/chrome:67
docker pull oldwebtoday/chrome:73

# Firefox
docker pull oldwebtoday/firefox:49
docker pull oldwebtoday/firefox:56
docker pull oldwebtoday/firefox:57

