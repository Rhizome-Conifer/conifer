import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { Link } from 'react-router-dom';
import { Panel } from 'react-bootstrap';

import SetStatus from 'components/SetStatus';


class Temp404UI extends PureComponent {
  static propTypes = {
    children: PropTypes.node,
    showLoginModal: PropTypes.func,
    set404: PropTypes.func,
    status: PropTypes.number
  };

  static defaultProps = {
    status: 404,
  };

  componentWillMount() {
    this.props.set404(true);
  }

  componentWillUnmount() {
    this.props.set404(false);
  }

  render() {
    const { children, status, showLoginModal } = this.props;

    return (
      <SetStatus code={status}>
        <Helmet>
          <title>Temporary Collection Not Found</title>
        </Helmet>
        <Panel bsStyle="danger" className="wr-error-notice">
          <Panel.Heading>Temporary Collection Not Found</Panel.Heading>
          <Panel.Body>
            <p>Sorry, this link is to a temporary collection, which is no longer available.</p>
            <p><Link to="/_register">Sign Up</Link> or <button className="button-link" type="button" onClick={showLoginModal}>Login</button> to keep a shareable permanent collctions on webrecorder.io</p>
          </Panel.Body>
        </Panel>
      </SetStatus>
    );
  }
}

export default Temp404UI;
