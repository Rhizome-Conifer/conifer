import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Alert, Button, ControlLabel, Form, FormControl, FormGroup } from 'react-bootstrap';

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

  validateItem = (key) => {
    if (this.state.error) {
      switch (key) {
        case 'email': {
          const { email } = this.state;
          if (!email || email.indexOf('@') === -1 || email.match(/\.\w+$/) === null) {
            return 'error';
          }
          return null;
        }
        case 'username':
          if (!this.state.username) {
            return 'error';
          }
          return null;
        default:
          return null;
      }
    }
  }

  render() {
    const { errors, success } = this.props;
    const { username, email } = this.state;

    return (
      <div className="row">
        {
          (success || errors) &&
            <Alert bsStyle={errors ? 'danger' : 'success'}>
              {
                errors ?
                  <span>Username or email address not found.</span> :
                  <span>A password reset e-mail has been sent to your e-mail!</span>
              }
            </Alert>
        }
        <div className={classNames('col-sm-6 col-md-6 col-md-offset-3 pw-reset-form', { success })}>
          <Form onSubmit={this.save}>
            <h3>Password Recovery</h3>
            <h4>Please enter either your e-mail address and/or username to request a password reset.</h4>

            <FormGroup validationState={this.validateItem('username')}>
              <ControlLabel>Username</ControlLabel>
              <FormControl
                aria-label="username"
                type="text"
                name="username"
                placeholder="Username"
                value={username}
                onChange={this.handleChange}
                autoFocus />
            </FormGroup>

            <div className="form-option"><span /><span className="opt">OR</span><span /></div>

            <FormGroup validationState={this.validateItem('email')}>
              <ControlLabel>Email</ControlLabel>
              <FormControl
                aria-label="email"
                type="email"
                name="email"
                placeholder="Email"
                value={email}
                onChange={this.handleChange} />
            </FormGroup>

            <Button bsStyle="primary" type="submit" disabled={success} block>Send Reset Email</Button>
          </Form>
        </div>
      </div>
    );
  }
}

export default ResetPasswordUI;
