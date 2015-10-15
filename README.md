# Webrecorder Project

This is the official repository of the Webrecorder web archiving platform: https://webrecorder.io/
Webrecorder provides an integrated platform for creating high-fidelity web archives while browsing, sharing, 
and disseminating archived content.

This is just the beginning, stay tuned for additional updates.


### Running Locally

Webrecorder can be run using Docker and Docker Compose.

### Configuration

Webrecorder is fully configured from `webrecorder/config.yaml`

Various environment and deployment settings are set in `webrecorder/webrecorder.env`

You may copy `webrecorder/webrecorder_sample.env` -> `webrecorder/webrecorder.env` and fill in the appropriate properties.

An automated init process will be added eventually.

Then, simply run `docker-compose up -d` and point the browser to port 8089 (by default).
