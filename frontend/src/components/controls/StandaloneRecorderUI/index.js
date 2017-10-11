import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, InputGroup, FormGroup, FormControl } from 'react-bootstrap';

import config from 'config';
import { addTrailingSlash, fixMalformedUrls, isMS, isSafari,
         remoteBrowserMod } from 'helpers/utils';

import { CollectionDropdown, ExtractWidget,
         RemoteBrowserSelect } from 'containers';

import './style.scss';


class StandaloneRecorderUI extends Component {
  static propTypes = {
    activeCollection: PropTypes.object,
    extractable: PropTypes.object,
    remoteBrowserSelected: PropTypes.object,
    username: PropTypes.string
  }

  constructor(props) {
    super(props);

    this.state = {
      recordingTitle: config.defaultRecordingTitle,
      url: ''
    };
  }

  componentDidMount() {
    console.log('StandaloneRecorderUI mounted');
  }

  handleInput = (evt) => {
    evt.preventDefault();
    this.setState({ [evt.target.name]: evt.target.value });
  }

  startRecording = (evt) => {
    evt.preventDefault();
    const { activeCollection, extractable, remoteBrowserSelected } = this.props;
    const { recordingTitle, url } = this.state;
    const cleanRecordingTitle = encodeURIComponent(recordingTitle.trim());

    let cleanUrl = addTrailingSlash(fixMalformedUrls(url));

    if (!remoteBrowserSelected && (isSafari() || isMS())) {
      cleanUrl = `mp_${cleanUrl}`;
    }

    if (extractable) {
      const extractMode = `${extractable.get('allSources') ? 'extract' : 'extract_only'}:${extractable.get('id')}${extractable.get('targetColl') ? `:${extractable.get('targetColl')}` : ''}`;
      window.location = `/_new/${activeCollection.id}/${cleanRecordingTitle}/${extractMode}/${remoteBrowserMod(remoteBrowserSelected, extractable.get('timestamp'))}/${extractable.get('targetUrl')}`;
    } else {
      window.location = `/_new/${activeCollection.id}/${cleanRecordingTitle}/record/${remoteBrowserMod(remoteBrowserSelected, null, '/')}${cleanUrl}`;
    }
  }

  render() {
    const { activeCollection, extractable } = this.props;
    const { recordingTitle, url } = this.state;

    const isOutOfSpace = false;
    const btnClasses = classNames({
      disabled: isOutOfSpace,
    });

    return (
      <form className="start-recording-homepage" onSubmit={this.startRecording}>
        <InputGroup className="col-md-8 col-md-offset-2 containerized">

          <div className="input-group-btn rb-dropdown">
            <RemoteBrowserSelect />
          </div>

          {/* TODO: annoying discrepancy in bootstrap height.. adding fixed height here */}
          <FormControl type="text" name="url" onChange={this.handleInput} style={{ height: '33px' }} value={url} placeholder="URL to record" required disabled={isOutOfSpace} />
          <label htmlFor="url" className="control-label sr-only">Url</label>

          {
            !extractable &&
              <div className="input-group-btn record-action">
                <Button bsStyle="default" type="submit" className={btnClasses}>
                  <span className="glyphicon glyphicon-dot-lg" /> Record
                </Button>
              </div>
          }

          <ExtractWidget
            includeButton
            toCollection={activeCollection.title}
            url={url} />

        </InputGroup>
        <FormGroup className="col-md-10 col-md-offset-2 top-buffer form-inline">

          <label htmlFor="recording-name">New Recording Name:&emsp;</label>
          <InputGroup>
            <FormControl id="recording-name" name="recordingTitle" onChange={this.handleInput} type="text" bsSize="sm" className="homepage-title" value={recordingTitle} required disabled={isOutOfSpace} />
          </InputGroup>

          <CollectionDropdown />

        </FormGroup>
      </form>
    );
  }
}

export default StandaloneRecorderUI;
