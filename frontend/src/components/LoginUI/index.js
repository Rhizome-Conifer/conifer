import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';
import { Col, Container, Row } from 'react-bootstrap';

import config from 'config';

import LoginForm from 'components/siteComponents/UserManagementUI/loginForm';

import './style.scss';


class LoginUI extends Component {
  static propTypes = {
    auth: PropTypes.object,
    assignNext: PropTypes.func,
    location: PropTypes.object,
    loginFn: PropTypes.func
  };

  componentDidMount() {
    const { location: { search } } = this.props;
    const qs = new URLSearchParams(search);
    if (qs.has('next')) {
      this.props.assignNext(qs.get('next'));
    }
  }

  render() {
    const { auth } = this.props;

    return (
      <div className="wr-login">
        <Helmet>
          <title>Log in to {config.product}</title>
        </Helmet>
        <Row className="justify-content-center">
          <Col xs={8}>
            <Col>
              <h2>{ config.product } Login</h2>
            </Col>
            <LoginForm
              auth={auth}
              cb={this.props.loginFn}
              error={auth.get('loginError')} />
          </Col>
        </Row>
      </div>
    );
  }
}


export default LoginUI;
