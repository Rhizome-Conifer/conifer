import React from 'react';
import { Helmet } from 'react-helmet';
import { Col, Row } from 'react-bootstrap';

import { product } from 'config';

import './style.scss';


function UserSignup() {
  return (
    <div className="signup-form">
      <Helmet>
        <title>Registration Closed</title>
      </Helmet>
      <Row>
        <Col xs={12} md={{ span: 8, offset: 2 }} lg={{ span: 6, offset: 3 }}>
          <div className="registration-closed">
            <h2>Conifer user registration is closed.</h2>
            <p>
              Details are described in the twilight announcement on the <a href="https://blog.conifer.rhizome.org/2025/12/15/twilight-announcement.html">Conifer blog</a>.
            </p>
          </div>
        </Col>
      </Row>
    </div>
  );
}

export default UserSignup;
