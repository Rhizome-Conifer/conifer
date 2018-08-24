# Webrecorder Project

Webrecorder provides an integrated platform for creating high-fidelity web archives while browsing, sharing,
and disseminating archived content.

This repository represents the hosted service deployed on https://webrecorder.io/ and can be deployed fully using Docker.

*If you have any questions or issues with the hosted service or issues, please contact us directly at support@webrecorder.io*

## History

Webrecorder has gone through several iterations, beginning in 2014.

Webrecorder is a project of Rhizome, developed with generous support from the Mellon Foundation.

This README corresponds to the 4.x release of Webrecorder, released in June, 2018.

*See [migration info](#migration-info) for migrating from a 3.x installation*

## Web Archiving For All! Using Webrecorder (and related tools)

Webrecorder and related tools are  designed to make web archiving more portable and decentralized, as well as to serve users and developers of all skill levels and requirements. The following options are available for end users and developers.


### Hosted Service

Using our hosted version of Webrecorder at https://webrecorder.io/, users can create a free account and create their own personal web archives. Archived web content will be available online, either publicly or privately, under each user account, and can also be downloaded by the owner at any time.

### Offline Browsing

The hosted service can also be used anonymously, and the archived content (WARC files) downloaded after each use.
We also provide a OSX/Windows/Linux Electron application, [Webrecorder Player](https://github.com/webrecorder/webrecorderplayer-electron) that can browse any WARC created by Webrecorder (or other web archiving tools) locally on the desktop. Once downloaded from Webrecorder, the player can be used to browse the content, even offline.

### Preconfigured Deployment

To deploy the full version of Webrecorder with Ansible and Linux machine, the [Webrecorder Deploy](https://github.com/webrecorder/webrecorder-deploy) workbook can be used to install this repository, configure nginx and other dependencies, such as SSL (via Lets Encrypt). The workbook is used for the https://webrecorder.io/ deployment.

### Manual Local Deployment

To deploy only the Webrecorder system in this repository, [follow the instructions](#running-locally) below on local deployment. Docker with Compose will be required.

### Deploying pywb

Finally, for users interested in the core replay system and very simple recording capabilities, deploying [pywb](https://github.com/webrecorder/pywb) may also make sense. Webrecorder is built on top of pywb, and the core functionality
is provided in pywb as a standalone Python application. See the [pywb reference manual](http://pywb.readthedocs.org/)
pywb can be deployed natively or in a Docker container as well.

## Running Locally

Webrecorder can be run on any system that has [Docker](https://docs.docker.com/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed. To install manually, clone

1). `git clone https://github.com/webrecorder/webrecorder`

2).  `cd webrecorder; bash init-default.sh`.

3). `docker-compose build`

4). `docker-compose up -d`

(The `init-default.sh` is a convenience script that copies [wr_sample.env](webrecorder/webrecorder/config/wr_sample.env) -> `wr.env` and creates keys for session encryption.)

Point your browser to port `http://localhost:8089/` to access Webrecorder.

### Configuration

Webrecorder configured from two files: `wr.env`, and less-commonly change system settings in `wr.yaml`.

The `wr.env` file contains numerous user-specific options for customization. In particular, the following options may be useful:

#### Host Names

By default, Webrecorder assumes its running on localhost/single domain, but on different ports for application and content.

To run Webrecorder (ideally behind https) on different domains, the `APP_HOST` and `CONTENT_HOST` env vars should be set.

For best results, the two domains should be two subdomains, to avoid third party issues while providing a separation between
the application and the archived content.

#### Storage

Webrecorder uses the `./data/` directory for local storage, or an external backend (currently supports s3).

The `DEFAULT_STORAGE` option in `wr.env` configures storage options, which can be `DEFAULT_STORAGE=local` or `DEFAULT_STORAGE=s3`

Webrecorder uses a temporary storage directory, for recording and temporary collections, and moves data
into a 'permanent' storage when recording is complete.

The temporary storage directory is: `WARCS_DIR=./data/warcs`. All active recording happens into this directory.

The permanent storage directory is either `STORAGE_DIR=./data/storage` for local storage.

When using s3, the STORAGE_DIR is not used, and data is placed into `S3_ROOT` which is an `s3://` bucket prefix url.

Additional s3 auth enviornment settings must also be set in `wr.env` or externally.

All 'web archiving data' (WARC and CDXJ files) are stored in the file system, while all other Webrecorder data is stored in 
the persistent Redis instance. (Redis persists data to `./data/dump.rdb`)

#### Mail

Webrecorder can send confirmation and lost password emails. By default, a local SMTP server is run in Docker, however, this can be configured to use a remote server by changing `EMAIL_SMTP_URL` and `EMAIL_SMTP_SENDER` environment settings.


### Administration tool

The `admin.py` script provides easy low level management of users. Adding, modifying, or removing users can be done via
the command line.

To interactively create a user:
`docker exec -it webrecorder_app_1 python -m webrecorder.admin -c`
or programmatically add users by supplying the appropriate positional values:
`... python -m webrecorder.admin -c <email> <username> <passwd> <role> '<full name>'`

Other arguments:

* `-m` modify a user
* `-d` delete a user
* `-i` create and send a new invite
* `-l` list invited users
* `-b` send backlogged invites

See `docker exec -it webrecorder_app_1 python -m webrecorder.admin --help` for full details.

### Restarting Webrecorder

When making changes to Webrecorder, running `docker-compose build; docker-compose up -d` will restart all of the containers.

To restart only the Webrecorder container, use the `./rebuild.sh` script.

## Migrating from Earlier Versions

The Webrecorder 4.x branch introduced signficant changes to the data model.

A migration script is provided which will migrate a local Webrecorder 3.x installation to 4.x.

To use, run:

*TODO*

Note: this process will create a copy of the Redis data in Redis DB 2. The old data will not be deleted automatically.
WARCs stored under `./data/warcs` will be moved to `./data/storage`.


## Webrecorder Architecture

This repository contains the Docker Compose setup for Webrecorder, and is the exact system deployed on https://webrecorder.io/. The full setup consists of the following components:

- `/app` - The Webrecorder Backend system includes the API, recording and warc access layers, split into 3 containers:
  - `app` -- The API and data model and rewriting system are found in this container.
  - `recorder` -- The WARC writer is found in this container.
  - `warcserver` -- The WARC loading and lookup is found in this container.
  
  The backend containers run different tools from [pywb](https://github.com/webrecorder/pywb), the core web archive replay toolkit library.
  
- `/frontend` - A React-based frontend application, running in Node.js. The frontend a modern interface for Webrecorder
and uses the backend api. All user access goes through frontend (after nginx).

- `/nginx` - A custom nginx deployment to provide routing and cacheing.

- `redis` - A Redis instance that stores all of the Webrecorder state (other than WARC and CDXJ).

- `dat-share` - An experimental component for sharing collections via the [Dat protocol](https://datproject.org/)

- `shepherd` - An instance of [OldWebToday Browser Shepherd](https://github.com/oldweb-today/browsers) for managing remote browsers.

- `mailserver` - A simple SMTP mail server for sending mail (for user registration)


### Dependencies

Webrecorder is built using both Python (for backend) and Node.js (for frontend) using a variety of Python
and Node open source libraries.

Webrecorder relies on a few separate repositories in this organization:
- [pywb](https://github.com/webrecorder/pywb)
- [warcio](https://github.com/webrecorder/warcio)
- [har2warc](https://github.com/webrecorder/har2warc)
- [public-web-archives](https://github.com/webrecorder/public-web-archives)
- [dat-share](https://github.com/webrecorder/dat-share)

The remote browser system uses https://github.com/oldweb-today/ repositories, including:
- [browsers](https://github.com/oldweb-today/browsers)
- [browser-chrome](https://github.com/oldweb-today/browser-chrome)
- [browser-firefox](https://github.com/oldweb-today/browser-firefox)


### Contact

Webrecorder is a project of [Rhizome](https://rhizome.org)

For any questions/concerns regarding the project or https://webrecorder.io/ you can:

* Open [issues](https://github.com/webrecorder/webrecorder/issues) on GitHub

* Tweet to us at https://twitter.com/webrecorder_io

* Contact us at support@webrecorder.io


### License

Webrecorder is Licensed under the Apache 2.0 License. See [NOTICE](NOTICE) and [LICENSE](LICENSE) for details.
