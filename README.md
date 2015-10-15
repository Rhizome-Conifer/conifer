# Webrecorder Project

This is the official repository of the Webrecorder web archiving platform: https://webrecorder.io/

Webrecorder provides an integrated platform for creating high-fidelity web archives while browsing, sharing, 
and disseminating archived content.

Webrecorder will support multiple backends and will integrate with existing preservation systems.

For now, Webrecorder is still in a beta prototype stage, and this deployment is recommended for advanced users only.

For best experience, please try Webrecorder at https://webrecorder.io/


### Running Locally

Webrecorder can be run using Docker and Docker Compose. See [Docker Installation](https://docs.docker.com/installation/) for details on installing Docker. See [Docker Compose Installation](https://docs.docker.com/compose/install/) for installing Compose.

1). `git clone https://github.com/webrecorder/webrecorder`

2). `cd webrecorder; bash init-default.sh` -- This is a convenience script that sets up environment settings `webrecorder/webrecorder.env`, including creating keys for session encryption.

3). `docker-compose build`

4). `docker-compouse up -d`

Point your browser to port `http://<DOCKER HOST>:8089/` to view the Webrecorder.

### Configuration

Webrecorder is fully configured from `webrecorder/config.yaml`, which includes full settings for the application.

Useful environment and deployment settings are loaded from `webrecorder/webrecorder.env` and can be overriden per-deployment.

Following are a few of these settings:

#### Storage

The `DEFAULT_STORAGE` option in `webrecorder.env` configures storage options. Default is just the local file system.

Currently, `s3` is also supported. To use s3, set `DEFAULT_STORAGE=s3` and fill in the additional auth settings in `webrecorder.env`

#### Mail

Webrecorder sends invitiation, confirmation and lost password emails. By default, a local SMTP server is run in Docker, however, this can be configured to use a remote server by changing `EMAIL_SMTP_URL` and `EMAIL_SMTP_SENDER`.

#### Invites

By default, Webrecorder allows anyone with access to the web site to register for an account. However, users may wish to limit
registration to specifically invited users. The `https://webrecorder.io/` deployment uses this feature at this time.

To require invites, simply set `REQUIRE_INVITES=true`

##3 Restarting Webrecorder

When making changes to Webrecorder, running `docker-compose build; docker-compose up -d` will restart all of the containers.

To restart only the Webrecorder container, use the `./rebuild.sh` script.

### Architecture

Webrecorder is built using a variety of open-source tools and uses [pywb](https://github.com/ikreymer/pywb), [warcprox](https://github.com/ikreymer/warcprox), Redis and Nginx. It is written in Python and uses the [Bottle](http://bottlepy.org/docs/dev/index.html), [Cork](http://cork.firelet.net/), [Beaker](https://beaker.readthedocs.org/en/latest/) frameworks.

### Contact

For any questions/concerns regarding Webrecorder or https://webrecorder.io/ you can open an issue or contat us at support@webrecorder.io


### License

Webrecorder is Licensed under the Apache 2.0 License. See [NOTICE](NOTICE) and [LICENSE](LICENSE) for details.
