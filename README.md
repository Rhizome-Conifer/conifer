# Webrecorder Project

*This version corresponds to the service deployed at https://webrecorder.io/*

*If you are interested in contributing to Webrecorder, or have any general questions, please contact us at support@webrecorder.io*

This is the official repository of the Webrecorder web archiving platform: https://webrecorder.io/

Webrecorder provides an integrated platform for creating high-fidelity web archives while browsing, sharing, 
and disseminating archived content.

Users may try the service anonymously or login and create a permanent online archive.

Webrecorder will support multiple backends and will integrate with existing preservation systems.

For now, Webrecorder is still in a beta prototype stage, and this deployment is recommended for advanced users only.

For best experience, please try Webrecorder at https://webrecorder.io/


### Running Locally

Webrecorder can be run using Docker and Docker Compose. See [Docker Installation](https://docs.docker.com/installation/) for details on installing Docker. See [Docker Compose Installation](https://docs.docker.com/compose/install/) for installing Compose.

1). `git clone https://github.com/webrecorder/webrecorder`

2).  `cd webrecorder; bash init-default.sh`.

3). `docker-compose build`

4). `docker-compose up -d`

(The `init-default.sh` is a convenience script that copies [wr_sample.env](wr.env) -> `wr.env` and creates keys for session encryption.)

Point your browser to port `http://<DOCKER HOST>:8089/` to view the Webrecorder.

### Configuration

Webrecorder is fully configured from `wr.yaml`, which includes full settings for the application and various containers.

Archived data (WARCs) are stored locally under the `./data/` directory, and all metadata and user info is stored in a persistent Redis instance.

Useful environment and deployment settings are loaded from `wr.env` and can be overriden per-deployment.

Following are a few of these settings:

#### Storage

The `DEFAULT_STORAGE` option in `wr.env` configures storage options. Default is just the local file system.

Currently, `s3` is also supported. To use s3, set `DEFAULT_STORAGE=s3` and fill in the additional auth settings in `wr.env`

With default local storage, archived data is kept in the `./data/warcs` directory only.


#### Mail

Webrecorder sends invitiation, confirmation and lost password emails. By default, a local SMTP server is run in Docker, however, this can be configured to use a remote server by changing `EMAIL_SMTP_URL` and `EMAIL_SMTP_SENDER`.

#### Invites

By default, Webrecorder allows anyone with access to the web site to register for an account. However, users may wish to limit
registration to specifically invited users. The `https://webrecorder.io/` deployment uses this feature at this time.

To require invites, simply set `REQUIRE_INVITES=true`

### Updating Deployment

When making changes to Webrecorder, running `docker-compose build; docker-compose up -d` will restart all of the containers.

To restart only the Webrecorder container, use the `./rebuild.sh` script.

### Architecture

Webrecorder is built using a variety of open-source tools and uses [pywb](https://github.com/ikreymer/pywb), Redis and Nginx. It is written in Python and uses the [Bottle](http://bottlepy.org/docs/dev/index.html), [Cork](http://cork.firelet.net/), [Beaker](https://beaker.readthedocs.org/en/latest/) frameworks.

### Contact

Webrecorder is a project of [Rhizome](https://rhizome.org), created by [Ilya Kreymer](https://github.com/ikreymer)

For any questions/concerns regarding the project or https://webrecorder.io/ you can:

* Open [issues](https://github.com/webrecorder/webrecorder/issues) on GitHub

* Tweet to us at https://twitter.com/webrecorder_io

* Contact us at support@webrecorder.io


### License

Webrecorder is Licensed under the Apache 2.0 License. See [NOTICE](NOTICE) and [LICENSE](LICENSE) for details.
