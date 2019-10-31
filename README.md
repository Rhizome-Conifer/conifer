
# Webrecorder Project
### *Web archiving for All!*
[![Join the chat at https://gitter.im/webrecorder/webrecorder](https://badges.gitter.im/webrecorder/webrecorder.svg)](https://gitter.im/webrecorder/webrecorder)

Webrecorder provides an integrated platform for creating high-fidelity, ISO-compliant web archives in a user-friendly interface, providing access to archived content, and sharing collections.

This repository represents the hosted service running on https://webrecorder.io/, which can also be [deployed locally using Docker](#running-locally)

This README refers to the 4.x version of Webrecorder, released in June, 2018.

The release included [a significant  UX redesign](https://rhizome.org/editorial/2018/jun/05/a-major-new-release-for-webrecorder/), including new curatorial features, and an [architecture redesign](#webrecorder-architecture) splitting the project into an API-based backend and a React-powered frontend architecture.

## Frequently asked questions

* If you have any questions about how to use Webrecorder, please see our [User Guide](https://guide.webrecorder.io/).

* If you have a question about your account on the hosted service (webrecorder.io), please contact us via email at [support@webrecorder.io](mailto:support@webrecorder.io)

* If you have a previous Webrecorder installation (version 3.x), see [Migration Info](migrating-4.0.md) for instructions on how to migrate to the latest version.





## Using the Webrecorder Platform

Webrecorder and related tools are designed to make web archiving more portable and decentralized, as well as to serve users and developers with a broad range of skill levels and requirements. Here are a few ways that Webrecorder can be used (starting with what probably requires the least technical expertise).

### 1. Hosted Service

Using our hosted version of Webrecorder at https://webrecorder.io/, users can sign up for a free account and create their own personal collections of web archives. Captures web content will be available online, either publicly or only privately, under each user account, and can be downloaded by the account owner at any time. Downloaded web archives are available as WARC files. (WARC is the ISO standard file format for web archives.) The hosted service can also be used anonymously and the captured content can be downloaded at the end of a temporary session.

### 2. Offline Capture and Browsing

We also provide two OSX/Windows/Linux Electron applications:

* [Webrecorder Player](https://github.com/webrecorder/webrecorder-player) browse WARCs created by Webrecorder (and other web archiving tools) locally on the desktop.
* [Webrecorder Desktop](https://github.com/webrecorder/webrecorder-desktop) a desktop version of the hosted Webrecorder service providing both capture and replay features.


### 3. Preconfigured Deployment

To deploy the full version of Webrecorder with Ansible on a Linux machine, the [Webrecorder Deploy](https://github.com/webrecorder/webrecorder-deploy) workbook can be used to install this repository, configure nginx and other dependencies, such as SSL (via Lets Encrypt). The workbook is used for the https://webrecorder.io/ deployment.

### 4. Full Webrecorder Local Deployment

The Webrecorder system in this repository can be deployed directly by [following the instructions below](#running-locally).
Webrecorder runs entirely in Docker and also requires Docker Compose.

### 5. Standalone Python Wayback (pywb) Deployment

Finally, for users interested in the core "replay system" and very basic recording capabilities, deploying [pywb](https://github.com/webrecorder/pywb) could also make sense. Webrecorder is built on top of pywb (Python Wayback/Python Web Archive Toolkit), and the core recording and replay functionality is provided by pywb as a standalone Python library. pywb comes with a Docker image as well.

pywb can be used to deploy your own web archive access service. See the [full pywb reference manual](http://pywb.readthedocs.org/) for further information on using and deploying pywb.

## Running Locally

Webrecorder can be run on any system that has [Docker](https://docs.docker.com/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed. To install manually, clone

1. `git clone https://github.com/webrecorder/webrecorder`

2. `cd webrecorder; bash init-default.sh`.

3. `docker-compose build`

4. `docker-compose up -d`

(The `init-default.sh` is a convenience script that copies [wr_sample.env](webrecorder/webrecorder/config/wr_sample.env) → `wr.env` and creates keys for session encryption.)

Point your browser to `http://localhost:8089/` to access the locally running Webrecorder instance.

(Note: you may see a maintenance message briefly while Webrecorder is starting up for the first time. Refresh the page after a few seconds to see the Webrecorder home page).

### Installing Remote Browsers

Remote Browsers are standard browsers like Google Chrome and Mozilla Firefox, encapsulated in Docker containers. This feature allows Webrecorder to directly use fixed versions of browsers for capturing and accessing web archives, with a more direct connection to the live web and web archives. Remote browsers in many cases can improve the quality of web archives during capture and access. They can be "remote controlled" by users and are launched as needed, and use the same amount of computing and memory resources as they would when just running as regular desktop apps.

Remote Browsers are optional, and can be installed as needed.

Remote Browsers are just Docker images which start with `oldweb-today/`, and are part of
[oldweb-today](https://github.com/oldweb-today/) organization on GitHub.
Installing the browsers can be as simple as running `docker pull` on each browser image each as well as
additional Docker images for the Remote Desktop system.

To install the Remote Desktop System and all of the officially supported Remote Browsers, run [install-browsers.sh](install-browsers.sh)


### Configuration

Webrecorder reads its configuration from two files: `wr.env`, and less-commonly changed system settings in `wr.yaml`.

The `wr.env` file contains numerous deployment-specific customization options. In particular, the following options may be useful:

#### Host Names

By default, Webrecorder assumes its running on localhost or a single domain, but on different ports for application (the Webrecorder user interface) and content (material rendered from web archives). This is a security feature preventing archived web sites accessing and possibly changing Webrecorder's user interface, and other unwanted interactions.

To run Webrecorder on different domains, the `APP_HOST` and `CONTENT_HOST` environment variables should be set.

For best results, the two domains should be two subdomains, both with https enabled.

The `SCHEME` env var should also be set to `SCHEME=https` when deploying via https.

#### Anonymous Mode

By default webrecorder disallows anonymous recording. To enable this feature, set ANON_DISABLED=false to the wr.env file and restart.

*Note: Previously the default setting was anonymous recording enabled (`ANON_DISABLED=false`)*

#### Storage

Webrecorder uses the `./data/` directory for local storage, or an external backend, currently supporting S3.

The `DEFAULT_STORAGE` option in `wr.env` configures storage options, which can be `DEFAULT_STORAGE=local` or `DEFAULT_STORAGE=s3`

Webrecorder uses a temporary storage directory for data while it is actively being captured, and temporary collections. Data is moved into the 'permanent' storage when the capturing process is completed or a temporary collection is imported into a user account.

The temporary storage directory is: `WARCS_DIR=./data/warcs`.

The permanent storage directory is either `STORAGE_DIR=./data/storage` or local storage.

When using s3, the value of `STORAGE_DIR` is ignored and data gets placed into `S3_ROOT` which is an `s3://` bucket URL.

Additional s3 auth environment settings must also be set in `wr.env` or externally.

All data related to Webrecorder that is not web archive data (WARC and CDXJ) is stored in the Redis instancem, which persists data to `./data/dump.rdb`. (See [Webrecorder Architecture](#webrecorder-architecture) below.)

#### Email

Webrecorder can send confirmation and password recovery emails. By default, a local SMTP server is run in Docker, but can be configured to use a remote server by changing the environment variables `EMAIL_SMTP_URL` and `EMAIL_SMTP_SENDER`.

#### Frontend Options

The react frontend includes a number of additional options useful for debugging. Setting `NODE_ENV=development` will switch react to development mode with hot reloading on port 8096.


### Administration tool

The script `admin.py` provides easy low level management of users. Adding, modifying, or removing users can be done via the command line.

To interactively create a user:

```sh
docker exec -it app python -m webrecorder.admin -c
```

or programmatically add users by supplying the appropriate positional values:

```sh
docker exec -it app  python -m webrecorder.admin \
                -c <email> <username> <passwd> <role> '<full name>'
```

Other arguments:

* `-m` modify a user
* `-d` delete a user
* `-i` create and send a new invite
* `-l` list invited users
* `-b` send backlogged invites

See `docker exec -it app python -m webrecorder.admin --help` for full details.

### Restarting Webrecorder

When making changes to the Webrecorder backend app, running

```sh
docker-compose kill app; docker-compose up -d app
```

will stop and restart the container.

To integrate changes to the frontend app, either set `NODE_ENV=development` and utilize hot reloading. If you're running production (`NODE_ENV=production`), run

```sh
docker-compose kill frontend; docker-compose up -d frontend
```

To fully recreate Webrecorder, deleting old containers (but not the data!) use the `./recreate.sh` script.

## Webrecorder Architecture

This repository contains the Docker Compose setup for Webrecorder, and is the exact system deployed on https://webrecorder.io/. The full setup consists of the following components:

- `/app` - The Webrecorder Backend system includes the API, recording and WARC access layers, split into 3 containers:
  - `app` -- The API and data model and rewriting system are found in this container.
  - `recorder` -- The WARC writer is found in this container.
  - `warcserver` -- The WARC loading and lookup is found in this container.

The backend containers run different tools from [pywb](https://github.com/webrecorder/pywb), the core web archive replay toolkit library.

- `/frontend` - A React-based frontend application, running in Node.js. The frontend is a modern interface for Webrecorder and uses the backend api. All user access goes through frontend (after nginx).

- `/nginx` - A custom nginx deployment to provide routing and caching.

- `redis` - A Redis instance that stores all of the Webrecorder state (other than WARC and CDXJ).

- `dat-share` - An experimental component for sharing collections via the [Dat protocol](https://datproject.org/)

- `shepherd` - An instance of [OldWebToday Browser Shepherd](https://github.com/oldweb-today/browsers) for managing remote browsers.

- `mailserver` - A simple SMTP mail server for sending user account management mail


### Dependencies

Webrecorder is built using both Python (for backend) and Node.js (for frontend) using a variety of Python and Node open source libraries.

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

* Ask questions via our Gitter channel at https://gitter.im/webrecorder/webrecorder

### License

Webrecorder is Licensed under the Apache 2.0 License. See [NOTICE](NOTICE) and [LICENSE](LICENSE) for details.
