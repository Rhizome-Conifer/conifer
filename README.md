# Webrecorder Project
### *Web archiving for All!*

Webrecorder provides an integrated platform for: creating high-fidelity web archives while browsing web pages, providing access to archived content, and sharing collections.

This repository represents the hosted service running on https://webrecorder.io/, which can also be [deployed locally using Docker](#running-locally)

This README refers to the 4.x version of Webrecorder, released in June, 2018.

The release included [a significant architectural and UI redesign, including new curatorial features](https://rhizome.org/editorial/2018/jun/05/a-major-new-release-for-webrecorder/). Webrecorder now includes a [separate API-based backend and a React-powered frontend architecture](#webrecorder-architecture).

**Users with Existing Installations**: If you have a previous Webrecorder installation (version 3.x), see [Migration Info](migrating-4.0.md) for instructions on how to migrate to the latest version.

*If you have any questions about how to use Webrecorder, please see our use guide at https://guide.webrecorder.io/*

*If you have a question about your account on the hosted service (https://webrecorder.io/), please contact us directly at support@webrecorder.io*

## Using Webrecorder Platform

Webrecorder and related tools are designed to make web archiving more portable and decentralized, as well as to serve users and developers with a broad range of skill levels and requirements. Here are a few ways that Webrecorder can be used (starting with what probably requires the least technical expertise).

### 1. Hosted Service

Using our hosted version of Webrecorder at https://webrecorder.io/, users can sign up for a free account and create their own personal collections of web archives. Archived web content will be available online, either publicly or only privately, under each user account, and can be downloaded by the account owner at any time. Downloaded web archives are available as a WARC file (WARC is the ISO standard file format for web archives). The hosted service can also be used anonymously and the archived content collected can be downloaded as a WARC file at the end of a temporary session. 

### 2. Offline Browsing

We also provide a OSX/Windows/Linux Electron application, [Webrecorder Player](https://github.com/webrecorder/webrecorderplayer-electron) that can browse any WARC created by Webrecorder (or other web archiving tools) locally on the desktop. Any WARCs downloaded from https://webrecorder.io/ can be browsed with Webrecorder Player, even offline.


### 3. Preconfigured Deployment

To deploy the full version of Webrecorder with Ansible and Linux machine, the [Webrecorder Deploy](https://github.com/webrecorder/webrecorder-deploy) workbook can be used to install this repository, configure nginx and other dependencies, such as SSL (via Lets Encrypt). The workbook is used for the https://webrecorder.io/ deployment.

### 4. Full Webrecorder Local Deployment

The Webrecorder system in this repository can be deployed directly by [following the instructions below](#running-locally).
Webrecorder runs entirely in Docker and also requires Docker Compose. The rest of this README covers the Webrecorder local deployment options.

### 5. Standalone Python Wayback (pywb) Deployment

Finally, for users interested in the core replay system and very basic recording capabilities, deploying [pywb](https://github.com/webrecorder/pywb) could also make sense. Webrecorder is built on top of pywb (Python Wayback/Python Web Archive Toolkit), and the core recording and replay functionality is provided by pywb as a standalone Python library (and comes with a Docker image as well).

See [the full pywb reference manual](http://pywb.readthedocs.org/) for further information on using and deploying pywb.

## Running Locally

Webrecorder can be run on any system that has [Docker](https://docs.docker.com/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed. To install manually, clone

1). `git clone https://github.com/webrecorder/webrecorder`

2). `cd webrecorder; bash init-default.sh`.

3). `docker-compose build`

4). `docker-compose up -d`

(The `init-default.sh` is a convenience script that copies [wr_sample.env](webrecorder/webrecorder/config/wr_sample.env) -> `wr.env` and creates keys for session encryption.)

Point your browser to `http://localhost:8089/` to access the locally running Webrecorder instance.

(Note: you may see a Webrecorder maintenance message briefly while Webrecorder is starting up for the first time. Refresh the page after a few seconds to see the Webrecorder home page).

### Installing Remote Browsers

The remote browsers available with Webrecorder are optional, and can be installed as needed.

Remote browsers are just Docker images which start with `oldweb-today/`, and part of
[oldweb-today](https://github.com/oldweb-today/) organization on GitHub.
Installing the browsers can be as simple as running `docker pull` on each image.

To install all of the officially supported browsers, run [install-browsers.sh](install-browsers.sh)

For example, to install a version of Chrome 60 and Firefox 49, run:

```
docker pull oldwebtoday/chrome:60
docker pull oldwebtoday/firefox:49
```

### Configuration

Webrecorder configured from two files: `wr.env`, and less-commonly changed system settings in `wr.yaml`.

The `wr.env` file contains numerous user-specific options for customization. In particular, the following options may be useful:

#### Host Names

By default, Webrecorder assumes its running on localhost/single domain, but on different ports for application and content.

To run Webrecorder (ideally behind https) on different domains, the `APP_HOST` and `CONTENT_HOST` env vars should be set.

For best results, the two domains should be two subdomains, to avoid third party issues while providing a separation between the application and the archived content.

The `SCHEME` env var should also be set to `SCHEME=https` when deploying via https.

#### Storage

Webrecorder uses the `./data/` directory for local storage, or an external backend, currently supporting s3.

The `DEFAULT_STORAGE` option in `wr.env` configures storage options, which can be `DEFAULT_STORAGE=local` or `DEFAULT_STORAGE=s3`

Webrecorder uses a temporary storage directory, for recording and temporary collections, and moves data into a 'permanent' storage when recording is complete.

The temporary storage directory is: `WARCS_DIR=./data/warcs`. All active recording happens into this directory.

The permanent storage directory is either `STORAGE_DIR=./data/storage` for local storage.

When using s3, the STORAGE_DIR is not used, and data is placed into `S3_ROOT` which is an `s3://` bucket prefix url.

Additional s3 auth environment settings must also be set in `wr.env` or externally.

All 'web archiving data' (WARC and CDXJ files) are stored in the file system, while all other Webrecorder data is stored in
the persistent Redis instance. (Redis persists data to `./data/dump.rdb`)

#### Mail

Webrecorder can send confirmation and lost password emails. By default, a local SMTP server is run in Docker, however, this can be configured to use a remote server by changing `EMAIL_SMTP_URL` and `EMAIL_SMTP_SENDER` environment settings.

#### Frontend Options

The react frontend includes a number of additional options, useful for debugging react. Setting `NODE_ENV=development` will switch react to development mode with hot reloading on port 8096.


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

When making changes to the Webrecorder backend app, running `docker-compose kill app; docker-compose up -d app` will stop and restart the container.

To integrate changes to the frontend app, either set `NODE_ENV` to `development` and utilize hot reloading, or run `docker-compose kill frontend; docker-compose up -d frontend` with `NODE_ENV=production`.

To fully recreate Webrecorder, deleting old containers (but not the data!) use the `./recreate.sh` script.

## Webrecorder Architecture

This repository contains the Docker Compose setup for Webrecorder, and is the exact system deployed on https://webrecorder.io/. The full setup consists of the following components:

- `/app` - The Webrecorder Backend system includes the API, recording and warc access layers, split into 3 containers:
  - `app` -- The API and data model and rewriting system are found in this container.
  - `recorder` -- The WARC writer is found in this container.
  - `warcserver` -- The WARC loading and lookup is found in this container.

  The backend containers run different tools from [pywb](https://github.com/webrecorder/pywb), the core web archive replay toolkit library.

- `/frontend` - A React-based frontend application, running in Node.js. The frontend is a modern interface for Webrecorder and uses the backend api. All user access goes through frontend (after nginx).

- `/nginx` - A custom nginx deployment to provide routing and caching.

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

Webrecorder is a project of [Rhizome](https://rhizome.org), developed with generous support from the Andrew W. Mellon Foundation.

For more info on using Webrecorder, you can consult our user guide at: https://guide.webrecorder.io/

For any general questions/concerns regarding the project or https://webrecorder.io/ you can:

* Open [issues](https://github.com/webrecorder/webrecorder/issues) on GitHub

* Tweet to us at https://twitter.com/webrecorder_io

* Contact us at support@webrecorder.io

### License

Webrecorder is Licensed under the Apache 2.0 License. See [NOTICE](NOTICE) and [LICENSE](LICENSE) for details.
