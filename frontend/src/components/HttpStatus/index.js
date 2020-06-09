import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';
import { Card } from 'react-bootstrap';
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

  constructor(props) {
    super(props);

    props.dispatch(set404(true));
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
        <Card className="wr-error-notice">
          <Card.Header>There's been an error</Card.Header>
          <Card.Body>
            { children || 'No such page or content is not accessible.'}
          </Card.Body>
        </Card>
      </SetStatus>
    );
  }
}

export default connect()(HttpStatus);
