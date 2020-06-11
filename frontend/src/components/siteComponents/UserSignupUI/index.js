import React, { Component } from 'react';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Alert, Button, Col, Form, Row } from 'react-bootstrap';

import { product, userRegex } from 'config';
import { registration as registrationErr } from 'helpers/userMessaging';

import { passwordPassRegex } from 'helpers/utils';
import { TempUsage } from 'containers';
import { LoaderIcon } from 'components/icons';

import './style.scss';


class UserSignup extends Component {
  static propTypes = {
    available: PropTypes.bool,
    cb: PropTypes.func,
    checkUser: PropTypes.func,
    checkedUsername: PropTypes.string,
    result: PropTypes.string,
    errors: PropTypes.object,
    submitting: PropTypes.bool,
    success: PropTypes.bool,
    user: PropTypes.object,
    userCheck: PropTypes.bool,
    validUsername: PropTypes.bool
  };

  constructor(props) {
    super(props);

    this.state = {
      moveTemp: true,
      toColl: 'New Collection',
      username: '',
      name: '',
      email: '',
      announce_mailer: false,
      password: '',
      confirmpassword: ''
    };
  }

  save = (evt) => {
    evt.preventDefault();
    const { user } = this.props;
    const {
      announce_mailer,
      confirmpassword,
      email,
      moveTemp,
      name,
      password,
      toColl,
      username
    } = this.state;

    if (
      this.validateUsername() &&
      this.validatePassword() &&
      this.validateEmail()
    ) {
      // core fields to send to server
      let data = { username, email, password, confirmpassword };

      if (announce_mailer) {
        data = { ...data, announce_mailer };
      }

      if (name) {
        data = { ...data, full_name: name };
      }

      // check for anon usage
      if (user.get('anon') && user.get('num_collections') > 0) {
        data = { ...data, moveTemp, toColl };
      }

      this.props.cb(data);
    }
  }

  handleChange = (evt) => {
    if (evt.target.type === 'radio') {
      this.setState({ [evt.target.name]: evt.target.value === 'yes' });
    } else if (evt.target.type === 'checkbox') {
      this.setState({ [evt.target.name]: !this.state[evt.target.name] });
    } else {
      this.setState({ [evt.target.name]: evt.target.value });
      if (evt.target.name === 'username') {
        clearTimeout(this.timeout);
        this.timeout = setTimeout(this.sendUserCheck, 250);
      }
    }
  }

  sendUserCheck = () => {
    const { userCheck, checkedUsername } = this.props;
    const { username } = this.state;

    if (!username || !this.userPassRegex(username)) {
      this.setState({ userIsRequired: true });
      return;
    }

    if (!userCheck || (userCheck && checkedUsername !== username)) {
      this.props.checkUser(username.trim());
    }
  }

  checkEmail = () => {
    this.setState({ checkEmail: true });
  }

  userPassRegex = (username) => {
    if (!username) {
      return false;
    }

    const rgx = username.match(userRegex);
    return rgx && rgx[0] === username;
  }

  validateUsername = () => {
    const { available, checkedUsername, userCheck } = this.props;
    const { username, userIsRequired } = this.state;

    if (username && username.length > 1) {
      // check if valid username formatting
      if (!this.userPassRegex(username)) {
        return null;
      }

      // check if already exists
      if (userCheck && username === checkedUsername && !available) {
        return false;
      }

      return true;
    } else if (userIsRequired) {
      return null;
    }

    return null;
  }

  validateEmail = () => {
    const { checkEmail, email } = this.state;

    if (checkEmail) {
      if (!email || email.indexOf('@') === -1 || email.match(/\.\w+$/) === null) {
        return false;
      }

      return true;
    }

    return null;
  }

  validatePassword = () => {
    const { password, confirmpassword } = this.state;

    if (password && confirmpassword) {
      if (!passwordPassRegex(password)) {
        return null;
      }

      if (password !== confirmpassword) {
        return false;
      }

      return true;
    }

    return null;
  }

  render() {
    const {
      errors,
      result,
      submitting,
      success,
      user
    } = this.props;
    const {
      email,
      moveTemp,
      name,
      password,
      confirmpassword,
      toColl,
      username
    } = this.state;

    const classes = classNames('wr-signup', {
      success
    });

    return (
      <Row className="signup-form">
        {
          (success || errors) &&
            <Alert
              className="top-buffer signup-alert"
              variant={errors ? 'danger' : 'success'}>
              {
                errors &&
                  <div>
                    <b>Errors:</b>
                    <ul>
                      {
                        errors.entrySeq().toArray().map(error => <li key={error[0]}>{`${registrationErr[error[1]]}`}</li>)
                      }
                    </ul>
                  </div>
              }
              {
                success &&
                  <p dangerouslySetInnerHTML={{ __html: result }} />
              }
            </Alert>
        }
        <Col xs={12} sm={6}>
          <h2>{ product } Account Sign-Up</h2>
          <h5>Create your own web archive as you browse!</h5>
          <br />
          <p>To begin, please fill out the registration form.</p>
        </Col>
        <Col xs={12} sm={6} className={classes}>
          <Form onSubmit={this.save} validated={this.state.formValid}>
            <Form.Group>
              <Form.Label>Choose a username for your archive</Form.Label>
              <Form.Control
                aria-label="username"
                type="text"
                name="username"
                placeholder="Username"
                value={username}
                onChange={this.handleChange}
                onBlur={this.sendUserCheck}
                required
                autoComplete="off"
                isInvalid={this.validateUsername() === false}
                autoFocus />
              <Form.Control.Feedback type="invalid">Sorry, this username is not available.</Form.Control.Feedback>
              {
                username && !this.userPassRegex(username) &&
                  <Form.Text bsPrefix="text-warning">Usernames must be 3-16 characters, and start with letter or digit and contain only letters, digit or -</Form.Text>
              }
            </Form.Group>

            <Form.Group>
              <Form.Label srOnly>Name:</Form.Label>
              <Form.Control
                aria-label="name"
                type="name"
                name="name"
                placeholder="Your Name (Optional)"
                value={name}
                onChange={this.handleChange} />
            </Form.Group>

            <Form.Group>
              <Form.Label srOnly>Email:</Form.Label>
              <Form.Control
                aria-label="email"
                type="email"
                name="email"
                placeholder="Your Email"
                value={email}
                onChange={this.handleChange}
                onBlur={this.checkEmail}
                required
                isInvalid={this.validateEmail() === false} />
              <Form.Control.Feedback type="invalid">Please provide a valid email</Form.Control.Feedback>
            </Form.Group>

            <Form.Group>
              <Form.Label srOnly>Password</Form.Label>
              <Form.Control
                aria-label="password"
                type="password"
                name="password"
                placeholder="Password"
                required
                value={password}
                onChange={this.handleChange} />
              {
                password && !passwordPassRegex(password) &&
                  <Form.Text bsPrefix="text-warning">Password must be at least 8 characters and contain lower, uppercase, and either digits or symbols</Form.Text>
              }
            </Form.Group>

            <Form.Group>
              <Form.Label srOnly>Password</Form.Label>
              <Form.Control
                aria-label="confirm password"
                type="password"
                name="confirmpassword"
                placeholder="Confirm Password"
                required
                value={confirmpassword}
                onChange={this.handleChange}
                onBlur={this.validatePassword}
                isInvalid={this.validatePassword() === false} />
              <Form.Control.Feedback type="invalid">Password confirmation does not match</Form.Control.Feedback>
            </Form.Group>

            <Form.Group controlId="mailingListSignup">
              <Form.Check
                type="checkbox"
                name="announce_mailer"
                label="Update me on new features."
                onChange={this.handleChange} />
            </Form.Group>

            {
              user.get('anon') && user.get('num_collections') > 0 &&
              <TempUsage
                handleInput={this.handleChange}
                moveTemp={moveTemp}
                toColl={toColl} />
            }

            <Button variant="primary" size="large" type="submit" block disabled={success || submitting}>
              {
                submitting && !success &&
                  <LoaderIcon />
              }
              Register
            </Button>

            <p className="top-buffer">
              By registering, you agree to our <Link to="/_policies">terms of service</Link>, including that we may use the provided email address to contact you from time to time in reference to the service and your account.
            </p>
          </Form>
        </Col>
      </Row>
    );
  }
}

export default UserSignup;
