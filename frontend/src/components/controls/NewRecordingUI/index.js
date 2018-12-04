import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { Panel } from 'react-bootstrap';

import config from 'config';

import { addTrailingSlash, apiFetch, fixMalformedUrls, remoteBrowserMod } from 'helpers/utils';

import { ExtractWidget, RemoteBrowserSelect } from 'containers';

import './style.scss';


class NewRecordingUI extends Component {
  static contextTypes = {
    canAdmin: PropTypes.bool,
    currMode: PropTypes.string,
    router: PropTypes.object
  }

  static propTypes = {
    collection: PropTypes.object,
    extractable: PropTypes.object,
    remoteBrowserSelected: PropTypes.string
  }

  constructor(props) {
    super(props);

    this.state = {
      url: ''
    };
  }

  handeSubmit = (evt) => {
    evt.preventDefault();
    const { collection, extractable, remoteBrowserSelected } = this.props;
    const { url } = this.state;

    const cleanUrl = addTrailingSlash(fixMalformedUrls(url));

    // data to create new recording
    const data = {
      url: cleanUrl,
      coll: collection.get('id'),
    };

    // add remote browser
    if (remoteBrowserSelected) {
      data.browser = remoteBrowserSelected;
    }

    if (extractable) {
      const mode = extractable.get('allSources') ? 'extract' : 'extract_only';
      data.url = extractable.get('targetUrl');
      data.mode = `${mode}:${extractable.get('id')}`;
      data.timestamp = extractable.get('timestamp');
    } else {
      data.mode = 'record';
    }

    // generate recording url
    apiFetch('/new', data, { method: 'POST' })
      .then(res => res.json())
      .then(({ url }) => this.context.router.history.push(url.replace(config.appHost, '')))
      .catch(err => console.log('error', err));
  }

  handleChange = (evt) => {
    this.setState({
      [evt.target.name]: evt.target.value
    });
  }

  render() {
    const { collection, extractable, spaceUtilization } = this.props;
    const { url } = this.state;
    const isOutOfSpace = spaceUtilization ? spaceUtilization.get('available') <= 0 : false;

    return (
      <React.Fragment>
        <Helmet>
          <title>New Capture</title>
        </Helmet>
        <div role="presentation" className="container-fluid wr-controls navbar-default new-recording-ui">
          <div className="main-bar">
            <form className="form-group-recorder-url start-recording" onSubmit={this.handeSubmit}>
              <div className="input-group containerized">
                <div className="input-group-btn rb-dropdown">
                  <RemoteBrowserSelect />
                </div>

                <input
                  autoFocus
                  required
                  aria-label="url-input"
                  className="url-input-recorder form-control"
                  disabled={isOutOfSpace}
                  name="url"
                  onChange={this.handleChange}
                  style={{ height: '3.3rem' }}
                  title={isOutOfSpace ? 'Out of space' : 'Enter URL to capture'}
                  type="text"
                  value={url} />

                <ExtractWidget
                  includeButton
                  toCollection={collection.get('title')}
                  url={url} />

                {
                  !extractable &&
                    <div className="input-group-btn record-action">
                      <button type="submit" className="btn btn-default" disabled={isOutOfSpace}>
                        Start
                      </button>
                    </div>
                }

              </div>
            </form>
          </div>
        </div>
        <div className="container col-md-4 col-md-offset-4 top-buffer-lg">
          <Panel>
            <Panel.Heading>Create a new capture</Panel.Heading>
            <Panel.Body>Ready to add a new capture to your collection <b>{collection.get('title')}</b></Panel.Body>
          </Panel>
        </div>
      </React.Fragment>
    );
  }
}

export default NewRecordingUI;
