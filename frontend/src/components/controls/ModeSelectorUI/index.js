import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, ButtonGroup, Col, DropdownButton, Row } from 'react-bootstrap';

import config from 'config';

import { apiFetch, remoteBrowserMod } from 'helpers/utils';

import OutsideClick from 'components/OutsideClick';
import { PatchIcon, PlayIcon, StopIcon } from 'components/icons';
import { Blinker, SizeCounter } from 'containers';

import './style.scss';

class ModeSelectorUI extends PureComponent {
  static propTypes = {
    activeBrowser: PropTypes.string,
    currMode: PropTypes.string,
    match: PropTypes.object,
    timestamp: PropTypes.string,
    url: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.state = {
      open: false
    };
  }

  onStop = (evt) => {
    evt.preventDefault();
    const { match: { params: { coll, rec, user } } } = this.props;

    if (this.props.currMode === "live") {
      this.props.history.push('/');
    } else if (this.props.currMode.indexOf('replay') !== -1) {
      //window.location.href = `/${user}/${coll}/index`;
      this.props.history.push(`/${user}/${coll}/manage`);
    } else {
      //window.location.href = `/${user}/${coll}/index?query=session:${rec}`;
      this.props.history.push(`/${user}/${coll}/manage?query=session:${rec}`);
    }
  }

  onReplay = () => {
    const { activeBrowser, match: { params: { coll, user } }, timestamp, url } = this.props;

    //window.location.href = `/${user}/${coll}/${remoteBrowserMod(activeBrowser, timestamp, '/')}${url}`;
    this.props.history.push(`/${user}/${coll}/${remoteBrowserMod(activeBrowser, timestamp, '/')}${url}`);
  }

  onPatch = () => {
    if (this.props.currMode === 'record') return;

    const { activeBrowser, history, match: { params: { coll } }, timestamp, url } = this.props;

    // data to create new recording
    const data = {
      url,
      coll,
      timestamp,
      mode: 'patch'
    };

    // add remote browser
    if (activeBrowser) {
      data.browser = activeBrowser;
    }
    // generate recording url
    apiFetch('/new', data, { method: 'POST' })
      .then(res => res.json())
      .then(({ url }) => history.push(url.replace(config.appHost, '')))
      .catch(err => console.log('error', err));
  }

  onRecord = () => {
    if (this.props.currMode === 'record') return;

    const { activeBrowser, history, match: { params: { coll } }, url } = this.props;
    const data = {
      url,
      coll,
      mode: 'record'
    };

    // add remote browser
    if (activeBrowser) {
      data.browser = activeBrowser;
    }
    // generate recording url
    apiFetch('/new', data, { method: 'POST' })
      .then(res => res.json())
      .then(({ url }) => history.push(url.replace(config.appHost, '')))
      .catch(err => console.log('error', err));
  }

  onStaticCopy = () => {

  }

  blinkIt = () => {
    if (!document.querySelector('.Blink').classList.contains('off')) {
      document.querySelector('.Blink').classList.add('off');
    } else {
      document.querySelector('.Blink').classList.remove('off');
    }
  };

  blinkAnimation = () => {
    setInterval(this.blinkIt, this.flickerTime);
  }

  close = () => {
    if (this.state.open) {
      this.setState({ open: false });
    }
  }

  toggle = () => {
    this.setState({ open: !this.state.open });
  }

  render() {
    const { currMode } = this.props;
    const { open } = this.state;
    let modeMessage;
    let modeMarkup;

    const isReplay = currMode.indexOf('replay') !== -1;
    const isRecord = currMode === 'record';
    const isExtract = currMode.indexOf('extract') !== -1;
    const isPatch = currMode === 'patch';
    const isLive = currMode === 'live';
    const isWrite = ['extract', 'extract_only', 'patch', 'record'].includes(currMode);

    switch(currMode) {
      case 'live':
        modeMessage = 'Previewing';
        modeMarkup = <span className="btn-content"><span className="preview-mode" aria-label="Preview icon" /><span className="d-none d-lg-inline">{ modeMessage }</span></span>;
        break;
      case 'record':
        modeMessage = 'Capturing';
        modeMarkup = <span className="btn-content"><Blinker /> <span className="d-none d-lg-inline">{ modeMessage }</span></span>;
        break;
      case 'replay':
      case 'replay-coll':
        modeMessage = 'Browsing';
        modeMarkup = <span className="btn-content"><PlayIcon /> <span className="d-none d-lg-inline">{ modeMessage }</span></span>;
        break;
      case 'patch':
        modeMessage = 'Patching';
        modeMarkup = <span className="btn-content"><PatchIcon /> <span className="d-none d-lg-inline">{ modeMessage }</span></span>;
        break;
      case 'extract':
      case 'extract_only':
        modeMessage = 'Extracting';
        modeMarkup = <span className="btn-content"><Blinker /> <span className="d-none d-lg-inline">{ modeMessage }</span></span>;
        break;
      default:
        break;
    }

    const modeSelectorClasses = classNames('wr-mode-selector', 'btn-group', { open });
    const isLiveMsg = isLive ? 'Start Capturing' : 'Capture this URL again';

    return (
      <div className="mode-selector">
        <ButtonGroup className="wr-mode-selector">
          <Button variant="outline-secondary" onClick={this.onStop} className="wr-mode-message content-action" aria-label={`Finish ${modeMessage} session`}>
            <span className="btn-content"><StopIcon /> <span className="d-none d-lg-inline">Stop</span></span>
            { modeMarkup }
            { isWrite && <SizeCounter /> }
          </Button>
          <DropdownButton alignLeft variant="outline-secondary" title="">
            <div className="container">
              {
                isLive &&
                  <Row className="wr-mode" onClick={this.onRecord} role="button" title="Stop preview mode and begin capturing">
                    <Col xs={1}>
                      <span className="glyphicon glyphicon-dot-sm glyphicon-recording-status wr-mode-icon" aria-hidden="true" />
                    </Col>
                    <Col>
                      <h5>Start Capture</h5>
                    </Col>
                  </Row>
              }
              {
                !isLive &&
                  <React.Fragment>
                    <Row className={classNames('wr-mode', { active: isRecord })} onClick={this.onRecord} role="button" title="Start a new recording session at the current URL">
                      <Col xs={1}>
                        <span className="glyphicon glyphicon-dot-sm glyphicon-recording-status wr-mode-icon" aria-hidden="true" />
                      </Col>
                      <Col>
                        <h5>{ isRecord ? 'Currently Capturing' : isLiveMsg }</h5>
                      </Col>
                    </Row>

                    <Row className={classNames('wr-mode', { active: isReplay, disabled: isLive })} onClick={this.onReplay} role="button" title="Access an archived version of this URL">
                      <Col xs={1}>
                        <PlayIcon />
                      </Col>
                      <Col>
                        <h5>{ isReplay ? 'Currently Browsing' : 'Browse this URL' }</h5>
                      </Col>
                    </Row>

                    <Row className={classNames('wr-mode', { active: isPatch, disabled: isRecord || isLive })} onClick={this.onPatch} role="button" title={isRecord ? 'Only available from replay after finishing a recording' : 'Record elements that are not yet in the collection'}>
                      <Col xs={1}>
                        <PatchIcon />
                      </Col>
                      <Col>
                        <h5>{ isPatch ? 'Currently Patching' : 'Patch this URL' }</h5>
                      </Col>
                    </Row>

                    {
                      isExtract &&
                        <Row className={classNames('wr-mode', { active: isExtract })} title="Start a new extraction at the current URL">
                          <Col xs={1}>
                            <span className="glyphicon glyphicon-save glyphicon-recording-status wr-mode-icon" aria-hidden="true" />
                          </Col>
                          <Col>
                            <h5>Currently Extracting</h5>
                          </Col>
                        </Row>
                    }
                  </React.Fragment>
              }
            </div>
          </DropdownButton>
        </ButtonGroup>
      </div>
    );
  }
}

export default ModeSelectorUI;
