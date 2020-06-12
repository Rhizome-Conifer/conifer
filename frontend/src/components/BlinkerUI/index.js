import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import { CircleIcon } from 'components/icons';

import './style.scss';


class BlinkerUI extends PureComponent {
  static propTypes = {
    bytes: PropTypes.number
  };

  render() {
    const { bytes } = this.props;

    return (
      <CircleIcon className={classNames('recording-status wr-mode-icon', { blink: bytes > 0 })} aria-hidden="true" />
    );
  }
}


export default BlinkerUI;
