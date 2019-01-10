import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Button, Popover } from 'react-bootstrap';

import { list as listErr } from 'helpers/userMessaging';
import { stopPropagation } from 'helpers/utils';

import Overlay from 'components/Overlay';
import OutsideClick from 'components/OutsideClick';
import { LoaderIcon, TrashIcon } from 'components/icons';

import './style.scss';


class RemoveWidget extends Component {
  static propTypes = {
    borderless: PropTypes.bool,
    callback: PropTypes.func,
    classes: PropTypes.string,
    children: PropTypes.node,
    deleteMsg: PropTypes.string,
    error: PropTypes.oneOfType([
      PropTypes.object,
      PropTypes.string
    ]),
    isDeleting: PropTypes.bool,
    placement: PropTypes.string,
    scrollCheck: PropTypes.string,
    withConfirmation: PropTypes.bool,
  };

  static defaultProps = {
    borderless: true,
    classes: '',
    deleteMsg: 'Are you sure you want to delete this item?',
    error: null,
    isDeleting: false,
    placement: 'bottom',
    withConfirmation: true
  };

  constructor(props) {
    super(props);

    this.state = {
      confirmRemove: false
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    if ((this.state.confirmRemove && nextProps.isDeleting !== this.props.isDeleting) ||
        this.state.confirmRemove !== nextState.confirmRemove) {
      return true;
    }

    return false;
  }

  componentDidUpdate(prevProps) {
    if (!this.props.isDeleting && prevProps.isDeleting) {
      this.setState({ confirmRemove: false });
    }
  }

  removeClick = (evt) => {
    evt.stopPropagation();

    if (!this.props.withConfirmation || this.state.confirmRemove) {
      if (!this.props.callback) {
        console.log('No RemoveWidget callback provided');
        return;
      }

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
    const { borderless, children, classes, deleteMsg, error, isDeleting, placement } = this.props;

    return (
      <React.Fragment>
        <div className="wr-remove-widget" style={{ position: 'relative' }}>
          <button
            className={classNames('remove-widget-icon', [classes], { borderless })}
            onClick={this.removeClick}
            ref={(obj) => { this.target = obj; }}
            type="button">
            { children || <TrashIcon />}
          </button>
          <Overlay target={() => this.target} placement={placement} show={this.state.confirmRemove}>
            <Popover id="wr-popover-delete" placement={placement} onClick={stopPropagation}>
              <OutsideClick handleClick={this.outsideClickCheck} scrollCheck={this.props.scrollCheck}>
                {
                  error ?
                    <p className="rm-error">{listErr[error] || 'Error Encountered'}</p> :
                    <p>{deleteMsg}</p>
                }
                <div className="action-row">
                  <Button onClick={this.outsideClickCheck} disabled={error || isDeleting}>Cancel</Button>
                  <Button bsStyle="danger" disabled={error || isDeleting} onClick={this.removeClick}>{isDeleting ? <LoaderIcon /> : 'OK'}</Button>
                </div>
              </OutsideClick>
            </Popover>
          </Overlay>
        </div>
      </React.Fragment>
    );
  }
}

export default RemoveWidget;
