import React, { Component } from 'react';
import PropTypes from 'prop-types';


class HttpStatus extends Component { // eslint-disable-line
  static defaultProps = {
    status: '404',
  }

  static propTypes = {
    status: PropTypes.string,
  }

  render() {
    const { status } = this.props;

    return (
      <p>Oops, Error { status }</p>
    );
  }
}

export default HttpStatus;
