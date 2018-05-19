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
    message: PropTypes.string,
    placement: PropTypes.string,
    usePortal: PropTypes.bool,
    scrollCheck: PropTypes.string
  };

  static defaultProps = {
    borderless: true,
    classes: '',
    withConfirmation: true,
    message: 'Confirm Delete',
    placement: 'bottom',
    usePortal: false
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

      this.setState({ confirmRemove: false });
      this.props.callback();
    } else {
      this.setState({ confirmRemove: true });
    }
  }

  outsideClickCheck = (evt) => {
    // if delete prompt is up, cancel it
    if (this.state.confirmRemove) {
      this.setState({ confirmRemove: false });
    }
  }

  render() {
    const { borderless, children, classes, placement, message } = this.props;
    return (
      <OutsideClick handleClick={this.outsideClickCheck} scrollCheck={this.props.scrollCheck} inlineBlock>
        <div className="wr-remove-widget" style={{ position: 'relative' }} onClick={this.removeClick}>
          <button
            ref={(obj) => { this.target = obj; }}
            className={classNames('remove-widget-icon', [classes], { borderless })}
            type="button">
            { children || <TrashIcon />}
          </button>
          {
            this.props.usePortal ?
              <Overlay target={() => this.target} placement={placement} show={this.state.confirmRemove}>
                <Tooltip placement={placement} className="in" id="confirm-remove">{ message }</Tooltip>
              </Overlay> :
              <BSOverlay container={this} placement={placement} target={this.target} show={this.state.confirmRemove}>
                <Tooltip placement={placement} id="confirm-remove">{ message }</Tooltip>
              </BSOverlay>
          }
        </div>
      </OutsideClick>
    );
  }
}

export default RemoveWidget;
