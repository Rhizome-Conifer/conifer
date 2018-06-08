import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { Panel } from 'react-bootstrap';
import { connect } from 'react-redux';

import { set404 } from 'store/modules/controls';

import SetStatus from 'components/SetStatus';


class HttpStatus extends PureComponent {
  static propTypes = {
    children: PropTypes.node,
    dispatch: PropTypes.func,
    status: PropTypes.number
  };

  static defaultProps = {
    status: 404,
  };

  componentWillMount() {
    this.props.dispatch(set404(true));
  }

  componentWillUnmount() {
    this.props.dispatch(set404(false));
  }

  render() {
    const { children, status } = this.props;

    return (
      <SetStatus code={status}>
        <Helmet>
          <title>There's been an error</title>
        </Helmet>
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

export default connect()(HttpStatus);
