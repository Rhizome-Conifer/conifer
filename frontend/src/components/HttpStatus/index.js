import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';

import SetStatus from 'components/SetStatus';


class HttpStatus extends PureComponent {
  static propTypes = {
    children: PropTypes.node,
    status: PropTypes.number
  };

  static defaultProps = {
    status: 404,
  };

  render() {
    const { children, status } = this.props;

    return (
      <SetStatus code={status}>
        { children || <p>Oops, Error { status }</p>}
      </SetStatus>
    );
  }
}

export default HttpStatus;
