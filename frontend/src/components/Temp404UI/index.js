import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Card } from 'react-bootstrap';

import config from 'config';

import SetStatus from 'components/SetStatus';


class Temp404UI extends PureComponent {
  static propTypes = {
    showLoginModal: PropTypes.func,
    set404: PropTypes.func,
    status: PropTypes.number
  };

  static defaultProps = {
    status: 404,
  };

  constructor(props) {
    super(props);

    props.set404(true);
  }

  componentWillUnmount() {
    this.props.set404(false);
  }

  render() {
    const { status, showLoginModal } = this.props;

    return (
      <SetStatus code={status}>
        <Helmet>
          <title>Temporary Collection Not Found</title>
        </Helmet>
        <Card variant="danger" className="wr-error-notice">
          <Card.Heading>Temporary Collection Not Found</Card.Heading>
          <Card.Body>
            <p>Sorry, this link is to a temporary collection, which is no longer available.</p>
            <p><Link to="/_register">Sign Up</Link> or <button className="button-link" type="button" onClick={showLoginModal}>Login</button> to keep shareable permanent collctions on {config.product}</p>
          </Card.Body>
        </Card>
      </SetStatus>
    );
  }
}

export default Temp404UI;
