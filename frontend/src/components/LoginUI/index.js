import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';
import { Col, Container, Row } from 'react-bootstrap';
import querystring from 'querystring';

import { product } from 'config';

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
    const qs = querystring.parse(search.replace('?', ''));
    if (qs.next) {
      this.props.assignNext(qs.next);
    }
  }

  render() {
    const { auth } = this.props;

    return (
      <div className="wr-login">
        <Helmet>
          <title>Log in to {product}</title>
        </Helmet>
        <Row className="justify-content-center">
          <Col xs={8}>
            <Col>
              <h2>{ product } Login</h2>
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
