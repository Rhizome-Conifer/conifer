import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { doubleRAF } from 'helpers/utils';

import { LoaderIcon, LockIcon } from 'components/icons';

import './style.scss';


class VisibilityLamp extends PureComponent {
  static propTypes = {
    callback: PropTypes.func,
    collPublic: PropTypes.bool,
    isPublic: PropTypes.bool,
    label: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.handle = null;
    this.editHandle = null;
    this.state = {
      editing: false,
      exited: false,
      indicator: false,
      open: false,
      width: 'auto'
    };
  }

  componentDidMount() {
    const bcr = this.bulb.getBoundingClientRect();
    this.setState({
      origWidth: bcr.width,
      width: 0
    });
  }

  componentDidUpdate(prevProps) {
    if (this.props.isPublic !== prevProps.isPublic) {
      clearTimeout(this.editHandle);
      this.setState({
        width: 'auto',
        editing: false,
        indicator: false
      });

      // exited checks for whether the the widget is still moused over
      // or if the user left while the edit was finishing..
      doubleRAF(() => {
        if (this.bulb) {
          const bcr = this.bulb.getBoundingClientRect();
          this.setState({
            origWidth: bcr.width,
            width: this.state.exited ? 0 : bcr.width,
            open: !this.state.exited,
            exited: false
          });
        }
      });
    }
  }

  componentWillUnmount() {
    clearTimeout(this.handle);
    clearTimeout(this.editHandle);
  }

  showStatus = () => {
    clearTimeout(this.handle);
    this.handle = setTimeout(() => {
      this.setState({
        open: true,
        width: this.state.origWidth
      });
    }, 30);
  }

  hideStatus = () => {
    // stay open if edit is in progress
    if (this.state.editing) {
      return this.setState({ exited: true });
    }

    clearTimeout(this.handle);
    this.handle = setTimeout(() => {
      this.setState({
        open: false,
        width: 0
      });
    }, 30);
  }

  toggle = (evt) => {
    evt.stopPropagation();

    if (this.state.editing) {
      return;
    }

    clearTimeout(this.editHandle);
    this.setState({ editing: true });

    // show loader if it's taking a while
    this.editHandle = setTimeout(() => this.setState({ indicator: true }), 150);
    this.props.callback();
  }

  render() {
    const { collPublic, isPublic, label } = this.props;
    const { indicator, width } = this.state;
    const staged = collPublic ? 'Public' : 'Staged';
    const help = isPublic ? `set ${label} private` : `set ${label} public`;

    return (
      <div
        aria-label={help}
        className={classNames('visibility-lamp', { 'is-public': isPublic, open: this.state.open || this.state.exited })}
        onClick={this.toggle}
        onMouseOver={this.showStatus}
        onMouseOut={this.hideStatus}
        title={help}>
        <div ref={(obj) => { this.bulb = obj; }} className="bulb" style={{ width }}>
          {
            indicator ?
              <LoaderIcon /> :
              <span>{isPublic ? staged : 'Private'}</span>
          }
        </div>
        {
          !isPublic ?
            <LockIcon /> :
            <div className="lamp" />
        }
      </div>
    );
  }
}

export default VisibilityLamp;
