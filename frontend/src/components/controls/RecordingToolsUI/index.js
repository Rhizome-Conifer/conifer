import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Button, DropdownButton, MenuItem } from 'react-bootstrap';

import { appHost, product } from 'config';
import { apiFetch } from 'helpers/utils';

import Modal from 'components/Modal';
import { BugReport, ShareWidget } from 'containers';

import './style.scss';


class RecordingToolsUI extends PureComponent {
  static propTypes = {
    activeBrowser: PropTypes.string,
    autoscroll: PropTypes.bool,
    history: PropTypes.object,
    match: PropTypes.object,
    timestamp: PropTypes.string,
    toggleAutoscroll: PropTypes.func,
    toggleClipboard: PropTypes.func,
    url: PropTypes.string
  };

  static contextTypes = {
    canAdmin: PropTypes.bool,
    currMode: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.state = { clipboardOpen: false };
  }

  onPatch = () => {
    if (this.context.currMode === 'record') return;

    const { activeBrowser, match: { params: { coll } }, timestamp, url } = this.props;

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
      .then(({ url }) => { window.location.href = url.replace(appHost, ''); })
      .catch(err => console.log('error', err));
  }

  onRecord = () => {
    if (this.context.currMode === 'record') return;

    const { activeBrowser, match: { params: { coll } }, url } = this.props;
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
      .then(({ url }) => { window.location.href = url.replace(appHost, ''); })
      .catch(err => console.log('error', err));
  }

  catalogView = () => {
    const { match: { params: { user, coll } } } = this.props;
    this.props.history.push(`/${user}/${coll}/manage`);
  }

  toggleAutoscroll = () => {
    this.props.toggleAutoscroll(!this.props.autoscroll);
  }

  userGuide = () => {
    this.props.history.push('/_documentation');
  }

  openClipboard = () => this.props.toggleClipboard(true)

  closeClipboard = () => this.props.toggleClipboard(false)

  _open = () => this.setState({ clipboardOpen: true })

  _close = () => this.setState({ clipboardOpen: false })

  render() {
    const { canAdmin, currMode } = this.context;
    const { activeBrowser, autoscroll } = this.props;

    const isNew = currMode === 'new';
    const isWrite = ['new', 'patch', 'record', 'extract'].includes(currMode);
    const modalFooter = <Button onClick={this._close}>Close</Button>;

    return (
      <div className="recording-actions text-center hidden-xs">
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
          canAdmin && !isNew &&
            <DropdownButton pullRight noCaret id="tool-dropdown" title={<span className="glyphicon glyphicon-option-vertical" aria-hidden="true" />}>
              <MenuItem onClick={this.catalogView}>Collection Index</MenuItem>
              {
                currMode.includes('replay') &&
                  <React.Fragment>
                    <MenuItem divider />
                    <MenuItem onClick={this.onPatch}>Patch this URL</MenuItem>
                    <MenuItem onClick={this.onRecord}>Record this URL again</MenuItem>
                  </React.Fragment>
              }
              <MenuItem divider />
              <MenuItem onClick={this.toggleAutoscroll}>{autoscroll ? 'Turn off' : 'Turn on'} autoscroll</MenuItem>
              {
                activeBrowser &&
                  <MenuItem onClick={this._open}>
                    <span className="glyphicon glyphicon-paste" /> Clipboard
                  </MenuItem>
              }
              <MenuItem divider />
              <MenuItem onClick={this.userGuide}>Help</MenuItem>
            </DropdownButton>
        }
        {
          !isNew && product !== 'player' &&
            <BugReport />
        }
        {
          !isWrite && product !== 'player' &&
            <ShareWidget />
        }
      </div>
    );
  }
}

export default RecordingToolsUI;
