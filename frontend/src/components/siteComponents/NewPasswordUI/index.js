import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import querystring from 'querystring';
import { Alert, Button, Col, Form, Row } from 'react-bootstrap';

import { product } from 'config';
import { passwordPassRegex } from 'helpers/utils';
import { passwordReset as passwordResetErr } from 'helpers/userMessaging';

import './style.scss';


class NewPasswordUI extends Component {
  static propTypes = {
    errors: PropTypes.object,
    location: PropTypes.object,
    match: PropTypes.object,
    setPassword: PropTypes.func,
    success: PropTypes.bool,
    toggleLogin: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.state = {
      newPass: '',
      newPass2: ''
    };
  }

  save = (evt) => {
    evt.preventDefault();
    const { match: { params: { resetCode } } } = this.props;
    const { newPass, newPass2 } = this.state;

    if (this.validateItem() && newPass === newPass2) {
      this.props.setPassword({ newPass, newPass2, resetCode });
    }
  }

  handleChange = (evt) => {
    this.setState({ [evt.target.name]: evt.target.value });
  }

  validateItem = () => {
    const { newPass } = this.state;

    if (newPass && !passwordPassRegex(newPass)) {
      return false;
    } else if (newPass && passwordPassRegex(newPass)) {
      return true;
    }

    return null;
  }

  render() {
    const { errors, location: { search }, success } = this.props;
    const { newPass, newPass2 } = this.state;
    const qs = querystring.parse(search.replace('?', ''));

    return (
      <React.Fragment>
        {
          (success || errors) &&
            <Alert variant={errors ? 'danger' : 'success'}>
              {
                errors ?
                  <span>{passwordResetErr[errors.get('error')]}</span> :
                  <span>Your password has been successfully reset! <Button variant="link" onClick={this.props.toggleLogin}>You can now login with your new password.</Button></span>
              }
            </Alert>
        }
        <Row className={classNames('new-pass', { success })}>
          <Col xs={12} sm={{ span: 6, offset: 3 }}>
            <Form onSubmit={this.save}>
              <h3>{product} password reset</h3>
              <p>Please enter a new password below:</p>

              <Form.Group>
                <Form.Label>Username:&emsp;</Form.Label>
                <b>{qs.username}</b>
              </Form.Group>

              <Form.Group>
                <Form.Label>New password</Form.Label>
                <Form.Control
                  required
                  autoFocus
                  aria-label="new password"
                  type="password"
                  name="newPass"
                  placeholder="new password"
                  value={newPass}
                  onChange={this.handleChange}
                  isInvalid={this.validateItem() === false} />
                <Form.Control.Feedback type="invalid">Password must be at least 8 characters and contain lower, uppercase, and either digits or symbols</Form.Control.Feedback>
              </Form.Group>

              <Form.Group>
                <Form.Label>Repeat new password</Form.Label>
                <Form.Control
                  required
                  aria-label="repeat new password"
                  type="password"
                  name="newPass2"
                  placeholder="repeat new password"
                  value={newPass2}
                  onChange={this.handleChange}
                  isInvalid={newPass2 && newPass !== newPass2} />
                <Form.Control.Feedback type="invalid">Password confirmation does not match</Form.Control.Feedback>
              </Form.Group>

              <Button variant="primary" type="submit" disabled={success} block>Reset Password</Button>
            </Form>
          </Col>
        </Row>
      </React.Fragment>
    );
  }
}

export default NewPasswordUI;
