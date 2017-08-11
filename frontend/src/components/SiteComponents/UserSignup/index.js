import React, { Component } from 'react';
import classNames from 'classnames';
import { Link } from 'react-router';
import PropTypes from 'prop-types';
import map from 'lodash/map';
import { Alert, Button, Checkbox, ControlLabel, Form,
         HelpBlock, FormControl, FormGroup } from 'react-bootstrap';

import config from 'config';

import './style.scss';


class UserSignup extends Component {
  static propTypes = {
    available: PropTypes.bool,
    cb: PropTypes.func,
    checkUser: PropTypes.func,
    checkedUsername: PropTypes.string,
    result: PropTypes.object,
    errors: PropTypes.array,
    success: PropTypes.bool,
    userCheck: PropTypes.bool,
    validUsername: PropTypes.bool
  };

  constructor(props) {
    super(props);

    this.state = {};
  }

  save = (evt) => {
    evt.preventDefault();
    const { announce_mailer, username, name, full_name,
            email, password, password2 } = this.state;

    if(!password || !password2) {
      this.setState({ missingPw: true });
    }

    if(username && this.validateUsername() === 'success' &&
       password && password2 && this.validatePassword() === null && email) {
      // core fields to send to server
      let data = { username, email, password, password2 };

      if(announce_mailer)
        data = { ...data, announce_mailer };

      if(name)
        data = { ...data, name };

      if(full_name)
        data = { ...data, full_name };

      this.props.cb(data);
    }
  }

  handleChange = (evt) => {
    if(evt.target.type === 'checkbox') {
      if(evt.target.name in this.state)
        this.setState({ [evt.target.name]: !this.state[evt.target.name] });
      else
        this.setState({ [evt.target.name]: true });
    } else {
      this.setState({ [evt.target.name]: evt.target.value });
    }
  }

  sendUserCheck = () => {
    const { userCheck, checkedUsername } = this.props;
    const { username } = this.state;

    if(!username) {
      this.setState({ userIsRequired: true });
      return;
    }

    if(!userCheck || (userCheck && checkedUsername !== username))
      this.props.checkUser(username.trim());
  }

  userPassRegex = (username) => {
    if(!username) return false;

    const rgx = username.match(config.userRegex);
    return rgx && rgx[0] === username;
  }

  validateUsername = () => {
    const { available, checkedUsername, userCheck } = this.props;
    const { username, userIsRequired } = this.state;

    if(username && username.length > 1) {
      // check if valid username formatting
      if(!this.userPassRegex(username))
        return 'error';

      // check if already exists
      if(userCheck && username === checkedUsername && !available)
        return 'error';

      return 'success';
    } else if(userIsRequired)
      return 'error';

    return null;
  }

  checkEmail = () => {
    this.setState({ checkEmail: true });
  }

  validateEmail = () => {
    const { checkEmail, email } = this.state;

    if(checkEmail && (!email || email.indexOf('@') === -1 || email.match(/\.\w+$/) === null))
      return 'error';

    return null;
  }

  passwordPassRegex = (password) => {
    if(!password) return false;

    const rgx = password.match(config.passwordRegex);
    return rgx && rgx[0] === password;
  }

  validatePassword = () => {
    const { password, password2, missingPw } = this.state;

    if(password && !this.passwordPassRegex(password))
      return 'warning';

    if((password && password2 && password !== password2) || missingPw)
      return 'error';

    return null;
  }


  render() {
    const { available, checkedUsername, errors, result,
            success, userCheck } = this.props;
    const { email, name, password, password2, username } = this.state;

    const classes = classNames('col-sm-6 col-md-4 col-md-offset-2 wr-signup', {
      success
    });

    return (
      <div className="row">
        {
          (success || errors) &&
            <Alert
              className="top-buffer"
              bsStyle={errors ? 'danger' : 'success'}>
              {
                errors &&
                  <div>
                    <b>Errors:</b>
                    <ul>
                      {
                        map(errors, (val, key) => <li>{`Error ${key}: ${val}`}</li>)
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
        <div className="col-sm-8 col-md-6 col-md-offset-2">
          <h2>{ config.product } Account Sign-Up</h2>
          <h4>Create your own web archive as you browse!</h4>
          <br />
          <h4>To begin, please fill out the registration form below.</h4>
          <br />
        </div>
        <div className={classes}>
          <Form onSubmit={this.save}>
            <FormGroup validationState={this.validateUsername()}>
              <ControlLabel>Choose a username for your archive</ControlLabel>
              <FormControl
                type="text"
                name="username"
                placeholder="Username"
                value={username}
                onChange={this.handleChange}
                onBlur={this.sendUserCheck}
                autoComplete="off"
                autoFocus />
              <FormControl.Feedback />
              {
                userCheck && username === checkedUsername && !available &&
                  <HelpBlock>This username already exists</HelpBlock>
              }
              {
                username && !this.userPassRegex(username) &&
                  <HelpBlock>Usernames must be 3-16 characters, and start with letter or digit and contain only letters, digit or -</HelpBlock>
              }
            </FormGroup>

            <FormGroup>
              <ControlLabel srOnly>Name:</ControlLabel>
              <FormControl
                type="name"
                name="name"
                placeholder="Your Name (Optional)"
                value={name}
                onChange={this.handleChange} />
            </FormGroup>

            <FormGroup style={{ display: 'none' }}>
              <ControlLabel srOnly>Name:</ControlLabel>
              <FormControl
                type="text"
                name="full_name" />
            </FormGroup>

            <FormGroup validationState={this.validateEmail()}>
              <ControlLabel srOnly>Email:</ControlLabel>
              <FormControl
                type="email"
                name="email"
                placeholder="Your Email"
                value={email}
                onChange={this.handleChange}
                onBlur={this.checkEmail} />
            </FormGroup>

            <FormGroup validationState={this.validatePassword()}>
              <ControlLabel srOnly>Password</ControlLabel>
              <FormControl
                type="password"
                name="password"
                placeholder="Password"
                value={password}
                onChange={this.handleChange} />
              {
                password && !this.passwordPassRegex(password) &&
                  <HelpBlock>Password must be at least 8 characters and contain lower, uppercase, and either digits or symbols</HelpBlock>
              }
            </FormGroup>

            <FormGroup validationState={this.validatePassword()}>
              <ControlLabel srOnly>Password</ControlLabel>
              <FormControl
                type="password"
                name="password2"
                placeholder="Confirm Password"
                value={password2}
                onChange={this.handleChange}
                onBlur={this.validatePassword} />
              {
                password && password2 && password !== password2 &&
                  <HelpBlock>Password confirmation does not match</HelpBlock>
              }
            </FormGroup>

            <FormGroup>
              <Checkbox
                name="announce_mailer"
                onChange={this.handleChange}>
                Update me on new features.
              </Checkbox>
            </FormGroup>

            <Button bsStyle="primary" bsSize="large" type="submit" block disabled={success}>Register</Button>

            <p className="top-buffer">
              By registering, you agree to our <Link to="/_policies">terms of service</Link>, including that we may use the provided email address to contact you from time to time in reference to the service and your account.
            </p>
          </Form>
        </div>
      </div>
    );
  }
}

export default UserSignup;
