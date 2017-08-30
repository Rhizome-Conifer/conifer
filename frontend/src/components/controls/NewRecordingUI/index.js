import React, { Component } from 'react';
import PropTypes from 'prop-types';

import config from 'config';

import { addTrailingSlash, fixMalformedUrls, isMS, isSafari,
         remoteBrowserMod } from 'helpers/utils';

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
    params: PropTypes.object,
    remoteBrowserSelected: PropTypes.object
  }

  constructor(props) {
    super(props);

    this.state = {
      recTitle: config.defaultRecordingTitle,
      url: ''
    };
  }

  handeSubmit = (evt) => {
    evt.preventDefault();
    const { collection, extractable, remoteBrowserSelected } = this.props;
    const { recTitle, url } = this.state;

    const collId = collection.get('id');
    const cleanRecordingTitle = encodeURIComponent(recTitle.trim());

    let cleanUrl = addTrailingSlash(fixMalformedUrls(url));

    if (!remoteBrowserSelected && (isSafari() || isMS())) {
      cleanUrl = `mp_${cleanUrl}`;
    }

    if (extractable) {
      const extractMode = `${extractable.get('allSources') ? 'extract' : 'extract_only'}:${extractable.get('id')}`;
      window.location = `/_new/${collId}/${cleanRecordingTitle}/${extractMode}/${remoteBrowserMod(remoteBrowserSelected, extractable.get('timestamp'))}/${extractable.get('targetUrl')}`;
    } else {
      window.location = `/_new/${collId}/${cleanRecordingTitle}/record/${remoteBrowserMod(remoteBrowserSelected, null, '/')}${cleanUrl}`;
    }
  }

  handleChange = (evt) => {
    this.setState({
      [evt.target.name]: evt.target.value
    });
  }

  render() {
    const { collection, extractable } = this.props;
    const { recTitle, url } = this.state;

    return (
      <div>
        <div role="presentation" className="container-fluid wr-controls navbar-default new-recording-ui">
          <div className="main-bar">
            <form className="form-group-recorder-url start-recording" onSubmit={this.handeSubmit}>
              <div className="input-group containerized">
                <div className="input-group-btn rb-dropdown">
                  <RemoteBrowserSelect />
                </div>

                <input type="text" onChange={this.handleChange} className="url-input-recorder form-control" name="url" value={url} autoFocus required />

                <ExtractWidget
                  includeButton
                  url={url} />

                {
                  !extractable &&
                    <div className="input-group-btn record-action">
                      <button type="submit" className="btn btn-default">
                        Start
                      </button>
                    </div>
                }

              </div>
              <div>
                <span className="recorder-status">Create New Recording</span>
                <label htmlFor="rec-title" className="sr-only">Recording title</label>
                <input name="recTitle" onChange={this.handleChange} type="text" className="left-buffer form-control input-sm title-inline" value={recTitle} required />
              </div>
            </form>
          </div>
        </div>

        <div className="container col-md-4 col-md-offset-4 top-buffer-lg">
          <div className="panel panel-default">
            <div className="panel-heading">
              <span className="glyphicon glyphicon-info-sign" aria-hidden="true" />
              <strong className="left-buffer">Create a new recording</strong>
            </div>
            <div className="panel-body">
              Ready to add a new recording to your collection <b>{collection.get('title')}</b>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default NewRecordingUI;
