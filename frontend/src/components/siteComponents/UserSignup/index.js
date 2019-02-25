import React, { Component } from 'react';
import classNames from 'classnames';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Alert, Button, Checkbox, ControlLabel, Form, HelpBlock, FormControl, FormGroup } from 'react-bootstrap';

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

  componentDidUpdate() {
    const { confirmpassword, missingPw, password } = this.state;

    // clear missing confirm password error
    if(missingPw && password && confirmpassword) {
      this.setState({ missingPw: false});
    }
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

    if (!password || !confirmpassword) {
      this.setState({ missingPw: true });
    }

    if (username && this.validateUsername() === 'success' &&
       password && confirmpassword && this.validatePassword() === null &&
       email && this.validateEmail() === null) {
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
    }
  }

  sendUserCheck = () => {
    const { userCheck, checkedUsername } = this.props;
    const { username } = this.state;

    if (!username) {
      this.setState({ userIsRequired: true });
      return;
    }

    if (!userCheck || (userCheck && checkedUsername !== username)) {
      this.props.checkUser(username.trim());
    }
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
        return 'error';
      }

      // check if already exists
      if (userCheck && username === checkedUsername && !available) {
        return 'error';
      }

      return 'success';
    } else if (userIsRequired) {
      return 'error';
    }

    return null;
  }

  checkEmail = () => {
    this.setState({ checkEmail: true });
  }

  validateEmail = () => {
    const { checkEmail, email } = this.state;

    if (checkEmail && (!email || email.indexOf('@') === -1 || email.match(/\.\w+$/) === null)) {
      return 'error';
    }

    return null;
  }

  validatePassword = () => {
    const { password, confirmpassword, missingPw } = this.state;

    if (password && !passwordPassRegex(password)) {
      return 'warning';
    }

    if ((password && confirmpassword && password !== confirmpassword) || missingPw) {
      return 'error';
    }

    return null;
  }

  render() {
    const {
      available,
      checkedUsername,
      errors,
      result,
      submitting,
      success,
      user,
      userCheck
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

    const classes = classNames('col-sm-6 col-md-6 col-md-offset-3 wr-signup', {
      success
    });

    return (
      <div className="row">
        {
          (success || errors) &&
            <Alert
              className="top-buffer signup-alert"
              bsStyle={errors ? 'danger' : 'success'}>
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
        <div className="col-sm-8 col-md-6 col-md-offset-3">
          <h2>{ product } Account Sign-Up</h2>
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
                aria-label="username"
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
                  <HelpBlock>Sorry, this username is not available.</HelpBlock>
              }
              {
                username && !this.userPassRegex(username) &&
                  <HelpBlock>Usernames must be 3-16 characters, and start with letter or digit and contain only letters, digit or -</HelpBlock>
              }
            </FormGroup>

            <FormGroup>
              <ControlLabel srOnly>Name:</ControlLabel>
              <FormControl
                aria-label="name"
                type="name"
                name="name"
                placeholder="Your Name (Optional)"
                value={name}
                onChange={this.handleChange} />
            </FormGroup>

            <FormGroup validationState={this.validateEmail()}>
              <ControlLabel srOnly>Email:</ControlLabel>
              <FormControl
                aria-label="email"
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
                aria-label="password"
                type="password"
                name="password"
                placeholder="Password"
                value={password}
                onChange={this.handleChange} />
              {
                password && !passwordPassRegex(password) &&
                  <HelpBlock>Password must be at least 8 characters and contain lower, uppercase, and either digits or symbols</HelpBlock>
              }
            </FormGroup>

            <FormGroup validationState={this.validatePassword()}>
              <ControlLabel srOnly>Password</ControlLabel>
              <FormControl
                aria-label="confirm password"
                type="password"
                name="confirmpassword"
                placeholder="Confirm Password"
                value={confirmpassword}
                onChange={this.handleChange}
                onBlur={this.validatePassword} />
              {
                password && confirmpassword && password !== confirmpassword &&
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

            {
              user.get('anon') && user.get('num_collections') > 0 &&
              <TempUsage
                handleInput={this.handleChange}
                moveTemp={moveTemp}
                toColl={toColl} />
            }

            <Button bsStyle="primary" bsSize="large" type="submit" block disabled={success || submitting}>
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
        </div>
      </div>
    );
  }
}

export default UserSignup;
