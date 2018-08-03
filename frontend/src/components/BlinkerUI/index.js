import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import './style.scss';


class BlinkerUI extends PureComponent {
  static propTypes = {
    bytes: PropTypes.number
  };

  render() {
    const { bytes } = this.props;

    return (
      <span className={classNames({ blink: bytes > 0 }, 'glyphicon glyphicon-dot-sm glyphicon-recording-status')} aria-hidden="true" />
    );
  }
}


export default BlinkerUI;
