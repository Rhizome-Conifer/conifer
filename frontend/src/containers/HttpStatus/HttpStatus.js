import React, { Component } from 'react';
import PropTypes from 'prop-types';

import SetStatus from 'components/SetStatus';


class HttpStatus extends Component { // eslint-disable-line
  static defaultProps = {
    status: '404',
  }

  static propTypes = {
    status: PropTypes.string,
  }

  render() {
    const { status } = this.props;
    console.log('rendering 404');

    return (
      <SetStatus code={404}>
        <p>Oops, Error { status }</p>
      </SetStatus>
    );
  }
}

export default HttpStatus;
