import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button } from 'react-bootstrap';

import { toggleClipboard } from 'redux/modules/toolBin';

import { SizeCounter } from 'containers';
import Modal from 'components/Modal';


class ToolBinUI extends Component {

  static propTypes = {
    activeBrowser: PropTypes.string,
    autoscroll: PropTypes.bool,
    open: PropTypes.bool,
    collSize: PropTypes.number,
    pageCount: PropTypes.number,
    toggleAutoscroll: PropTypes.func,
    toggleClipboard: PropTypes.func
  };

  static contextTypes = {
    currMode: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.state = { animate: false, clipboardOpen: false };
  }

  componentDidMount() {
    this.setState({ animate: true });
  }

  openClipboard = () => this.props.toggleClipboard(true)
  closeClipboard = () => this.props.toggleClipboard(false)
  _open = () => this.setState({ clipboardOpen: true });
  _close = () => this.setState({ clipboardOpen: false });

  toggleScroll = () => {
    this.props.toggleAutoscroll(!this.props.autoscroll);
  }

  render() {
    const { activeBrowser, pageCount, collSize, open } = this.props;
    const { currMode } = this.context;
    const classes = classNames('container-fluid wr-tools', { animate: this.state.animate, open });
    const isReplay = currMode.indexOf('replay') !== -1;

    return (
      <div className={classes}>
        {
          isReplay &&
            <div>
              <strong>collection info:</strong>
              <span className="left-buffer bookmark-count">{`${pageCount} page${pageCount === 1 ? '' : 's'}`}</span>
              <span className="size-counter size-counter-active">
                <SizeCounter
                  bytes={collSize}
                  classes="left-buffer-md" />
              </span>
            </div>
        }
        {
          isReplay &&
            <span className="wr-divider" />
        }
        <Button bsSize="xs" onClick={this.toggleScroll} active={this.props.autoscroll}>Autoscroll</Button>
        {
          /* TODO: condensed share widget */
          (currMode === 'recorder' || currMode === 'patch') &&
            <span />
        }
        {
          activeBrowser &&
            <React.Fragment>
              <Button bsSize="xs" style={{ marginLeft: 15 }} onClick={this._open}><span className="glyphicon glyphicon-paste" /> Clipboard</Button>
              <Modal
                visible={this.state.clipboardOpen}
                header={<h4>Remote Browser Clipboard</h4>}
                closeCb={this._close}
                propsPass={{ onEntered: this.openClipboard, onExited: this.closeClipboard }}
                footer={<Button onClick={this._close}>Close</Button>}>
                <p>Any text selected in the remote browser will appear below.</p>
                <p>You can also enter text here to paste (Ctrl+V) into the remote browser.</p>
                <textarea id="clipboard" autoFocus style={{ width: '100%', minHeight: 200 }} />
              </Modal>
            </React.Fragment>
        }
      </div>
    );
  }
}

export default ToolBinUI;
