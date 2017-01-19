import React, { Component, PropTypes } from 'react';


class HttpStatus extends Component { // eslint-disable-line
  render() {
    const { status } = this.props;

    return (
      <p>Oops, Error { status }</p>
    );
  }
}

HttpStatus.propTypes = {
  status: PropTypes.string,
};

HttpStatus.defaultProps = {
  status: '404',
};

export default HttpStatus;
