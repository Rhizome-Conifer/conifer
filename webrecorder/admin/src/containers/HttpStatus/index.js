import React, { Component, PropTypes } from 'react';


class HttpStatus extends Component {

  render() {
    const { status } = this.props;

    return (
      <p>Error { status }</p>
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
