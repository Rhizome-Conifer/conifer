import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Overlay, Tooltip } from 'react-bootstrap';

import OutsideClick from 'components/OutsideClick';
import { TrashIcon } from 'components/icons';

import './style.scss';


class RemoveWidget extends Component {
  static propTypes = {
    callback: PropTypes.func,
    withConfirmation: PropTypes.bool,
    message: PropTypes.string
  };

  static defaultProps = {
    withConfirmation: true,
    message: 'Confirm Delete'
  };

  constructor(props) {
    super(props);

    this.state = {
      confirmRemove: false
    };
  }

  removeClick = (evt) => {
    evt.stopPropagation();

    if (!this.props.withConfirmation || this.state.confirmRemove) {
      this.setState({ confirmRemove: false });
      this.props.callback();
    }

    this.setState({ confirmRemove: true });
  }

  outsideClickCheck = () => {
    // if delete prompt is up, cancel it
    if (this.state.confirmRemove) {
      this.setState({ confirmRemove: false });
    }
  }

  render() {
    const { message } = this.props;

    return (
      <div className="wr-remove-widget" style={{ position: 'relative' }}>
        <OutsideClick handleClick={this.outsideClickCheck} inlineBlock>
          <button ref={(obj) => { this.target = obj; }} className="borderless remove-widget-icon" onClick={this.removeClick}><TrashIcon /></button>
        </OutsideClick>
        {/* todo: add portal option for tooltip */}
        <Overlay container={this} placement="bottom" target={this.target} show={this.state.confirmRemove}>
          <Tooltip placement="bottom" id="confirm-remove">{ message }</Tooltip>
        </Overlay>
      </div>
    );
  }
}

export default RemoveWidget;
