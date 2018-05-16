import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Panel } from 'react-bootstrap';

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
        <Panel bsStyle="danger" className="wr-error-notice">
          <Panel.Heading>There's been an error</Panel.Heading>
          <Panel.Body>
            { children || 'No such page or content is not accessible.'}
          </Panel.Body>
        </Panel>
      </SetStatus>
    );
  }
}

export default HttpStatus;
