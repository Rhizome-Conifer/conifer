import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button } from 'react-bootstrap';

import { appHost, product } from 'config';
import { apiFetch } from 'helpers/utils';

import { ShareWidget } from 'containers';

import Modal from 'components/Modal';
import { ClipboardIcon, WandIcon } from 'components/icons';

import './style.scss';


class RecordingToolsUI extends PureComponent {
  static propTypes = {
    activeBrowser: PropTypes.string,
    auth: PropTypes.object,
    autopilotInfo: PropTypes.object,
    canAdmin: PropTypes.bool,
    currMode: PropTypes.string,
    history: PropTypes.object,
    autopilot: PropTypes.bool,
    match: PropTypes.object,
    timestamp: PropTypes.string,
    toggleClipboard: PropTypes.func,
    toggleAutopilotSidebar: PropTypes.func,
    url: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.state = { clipboardOpen: false };
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
      .then(({ url }) => { history.push(url.replace(appHost, '')); })
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
      .then(({ url }) => { history.push(url.replace(appHost, '')); })
      .catch(err => console.log('error', err));
  }

  startAuto = () => {
    apiFetch(`/browser/behavior/start/${this.props.reqId}`, {}, { method: 'POST' });
  }

  stopAuto = () => {
    apiFetch(`/browser/behavior/stop/${this.props.reqId}`, {}, { method: 'POST' });
  }

  openClipboard = () => this.props.toggleClipboard(true)

  closeClipboard = () => this.props.toggleClipboard(false)

  _open = () => this.setState({ clipboardOpen: true })

  _close = () => this.setState({ clipboardOpen: false })

  toggleAutopilotSidebar = () => {
    this.props.toggleAutopilotSidebar(!this.props.autopilot);
  }

  render() {
    const { activeBrowser, autopilotInfo, canAdmin, currMode } = this.props;

    const isNew = currMode === 'new';
    const isWrite = ['new', 'patch', 'record', 'extract', 'live'].includes(currMode);
    const modalFooter = <Button onClick={this._close}>Close</Button>;
    const specialBehavior = autopilotInfo && autopilotInfo.size > 1;

    return (
      <div className="recording-actions d-none d-sm-flex">
        <Modal
          visible={this.state.clipboardOpen}
          header={<h4>Remote Browser Clipboard</h4>}
          closeCb={this._close}
          propsPass={{ onEntered: this.openClipboard, onExited: this.closeClipboard }}
          footer={modalFooter}>
          <p>Any text selected in the remote browser will appear below.</p>
          <p>You can also paste text here to send to remote browser.</p>
          <textarea id="clipboard" autoFocus style={{ width: '100%', minHeight: 200 }} />
        </Modal>

        {
          canAdmin && !isNew && activeBrowser &&
            <Button
              variant="outline-secondary"
              className="clipboard-btn"
              aria-label="Remote browser clipboard"
              onClick={this._open}>
              <ClipboardIcon />
            </Button>
        }

        {
          isWrite && currMode !== 'live' &&
            <Button variant={specialBehavior ? "primary" : "outline-secondary"} className="autopilot-btn" onClick={this.toggleAutopilotSidebar}><WandIcon />Autopilot</Button>
        }

        {
          !isWrite && !__DESKTOP__ &&
            <ShareWidget canAdmin={canAdmin} />
        }
      </div>
    );
  }
}

export default RecordingToolsUI;
