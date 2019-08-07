#!/bin/sh

# This script pulls the available remote browsers, and the remote desktop system
# The remote desktop system containers are required for any browser
# Browsers can be installed individually if installing all of the browsers is not desired.

# By default, only latest versions of browsers are pulled. Uncomment other versions to include them as well.

# Remote Desktop System and Base Browser (Required for all browsers)
docker pull oldwebtoday/vnc-webrtc-audio
docker pull oldwebtoday/base-displayaudio
docker pull oldwebtoday/base-browser

# For automation (works with chrome 67 and up)
docker pull webrecorder/autobrowser

# pull behaviors to ensure latest version
docker pull webrecorder/behaviors

# Chrome
#docker pull oldwebtoday/chrome:53
#docker pull oldwebtoday/chrome:60
#docker pull oldwebtoday/chrome:67
#docker pull oldwebtoday/chrome:73
docker pull oldwebtoday/chrome:76

# Firefox
# for java support, include ff 49
docker pull oldwebtoday/firefox:49
#docker pull oldwebtoday/firefox:56
#docker pull oldwebtoday/firefox:57
docker pull oldwebtoday/firefox:68

