import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Overlay as BSOverlay, Tooltip } from 'react-bootstrap';

import Overlay from 'components/Overlay';
import OutsideClick from 'components/OutsideClick';
import { TrashIcon } from 'components/icons';

import './style.scss';


class RemoveWidget extends Component {
  static propTypes = {
    borderless: PropTypes.bool,
    callback: PropTypes.func,
    classes: PropTypes.string,
    children: PropTypes.node,
    withConfirmation: PropTypes.bool,
    message: PropTypes.string
  };

  static defaultProps = {
    borderless: true,
    classes: '',
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
      if (!this.props.callback) {
        console.log('No RemoveWidget callback provided');
        return;
      }

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
    const { borderless, children, classes, message } = this.props;

    return (
      <div className="wr-remove-widget" style={{ position: 'relative' }}>
        <OutsideClick handleClick={this.outsideClickCheck} inlineBlock>
          <button
            ref={(obj) => { this.target = obj; }}
            className={classNames('remove-widget-icon', [classes], { borderless })}
            onClick={this.removeClick}
            type="button">
            { children || <TrashIcon />}
          </button>
        </OutsideClick>
        {/*
        <BSOverlay container={this} placement="bottom" target={this.target} show={this.state.confirmRemove}>
          <Tooltip placement="bottom" id="confirm-remove">{ message }</Tooltip>
        </BSOverlay>*/}
        <Overlay target={() => this.target} show={this.state.confirmRemove}>
          <Tooltip placement="bottom" className={classNames({ in: this.state.confirmRemove })} id="confirm-remove">{ message }</Tooltip>
        </Overlay>
      </div>
    );
  }
}

export default RemoveWidget;
