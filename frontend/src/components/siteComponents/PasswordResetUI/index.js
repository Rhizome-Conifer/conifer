import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Alert, Button, Col, Form, Row } from 'react-bootstrap';

import './style.scss';


class ResetPasswordUI extends Component {
  static propTypes = {
    cb: PropTypes.func,
    errors: PropTypes.object,
    success: PropTypes.bool
  };

  constructor(props) {
    super(props);

    this.state = {
      email: '',
      error: false,
      username: ''
    };
  }

  save = (evt) => {
    evt.preventDefault();
    const { email, username } = this.state;

    if (email || username) {
      this.props.cb(this.state);
    } else {
      this.setState({ error: true });
    }
  }

  handleChange = (evt) => {
    this.setState({ [evt.target.name]: evt.target.value });
  }

  render() {
    const { errors, success } = this.props;
    const { username, email } = this.state;

    return (
      <Row>
        <Col xs={12} sm={{ span: 8, offset: 2}}>
          {
            (success || errors) &&
              <Alert className="top-buffer" variant={errors ? 'danger' : 'success'}>
                {
                  errors ?
                    <span>Username or email address not found.</span> :
                    <span>A password reset e-mail has been sent to your e-mail!</span>
                }
              </Alert>
          }
        </Col>
        <Col xs={12} sm={{ span: 8, offset: 2 }} className={classNames('pw-reset-form', { success })}>
          <Form onSubmit={this.save}>
            <h3>Password Recovery</h3>
            <h5>Please enter either your e-mail address and/or username to request a password reset.</h5>

            <Form.Group>
              <Form.Label>Username</Form.Label>
              <Form.Control
                required={!username && !email}
                aria-label="username"
                type="text"
                name="username"
                placeholder="Username"
                value={username}
                onChange={this.handleChange}
                autoFocus />
            </Form.Group>

            <div className="form-option"><span /><span className="opt">OR</span><span /></div>

            <Form.Group>
              <Form.Label>Email</Form.Label>
              <Form.Control
                required={!username && !email}
                aria-label="email"
                type="email"
                name="email"
                placeholder="Email"
                value={email}
                onChange={this.handleChange} />
            </Form.Group>

            <Button variant="primary" type="submit" disabled={success} block>Send Reset Email</Button>
          </Form>
        </Col>
      </Row>
    );
  }
}

export default ResetPasswordUI;
