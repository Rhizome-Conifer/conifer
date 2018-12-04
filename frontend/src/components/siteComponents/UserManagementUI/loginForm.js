import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Alert, Button, Col, Form, FormGroup, FormControl, Row } from 'react-bootstrap';

import { guestSessionTimeout, product, userRegex } from 'config';
import { login } from 'helpers/userMessaging';

import { TempUsage } from 'containers';


class LoginForm extends Component {
  static propTypes = {
    anonCTA: PropTypes.bool,
    auth: PropTypes.object,
    cb: PropTypes.func,
    error: PropTypes.bool,
    closeLogin: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.state = {
      moveTemp: true,
      toColl: 'New Collection',
      remember_me: false,
      username: '',
      password: ''
    };
  }

  save = (evt) => {
    evt.preventDefault();
    const { auth } = this.props;
    const { moveTemp, password, toColl, username } = this.state;

    let data = { username, password };

    if (this.state.remember_me) {
      data.remember_me = '1';
    }

    // check for anon usage
    if (auth.getIn(['user', 'anon']) && auth.getIn(['user', 'num_collections']) > 0) {
      data = { ...data, moveTemp, toColl };
    }

    this.props.cb(data);
  }

  validateUsername = () => {
    const pattern = userRegex;
    if (typeof this.state.username !== 'undefined') {
      return this.state.username.match(pattern) === this.state.username ? null : 'warning';
    }
    return null;
  }

  handleChange = (evt) => {
    if (evt.target.type === 'radio') {
      this.setState({ [evt.target.name]: evt.target.value === 'yes' });
    } else {
      this.setState({ [evt.target.name]: evt.target.value });
    }
  }

  render() {
    const { anonCTA, auth, closeLogin, error } = this.props;
    const { moveTemp, password, toColl, username } = this.state;

    return (
      <React.Fragment>
        <Row className="wr-login-form">
          {
            anonCTA &&
              <h4>Please sign in to manage collections.</h4>
          }
          {
            error &&
              <Alert bsStyle="danger">
                {
                  login[auth.get('loginError')] || <span>Invalid Login. Please Try Again</span>
                }
              </Alert>
          }
          <Form id="loginform" onSubmit={this.save}>
            <FormGroup
              key="username">
              <label htmlFor="username" className="sr-only">Username</label>
              <FormControl aria-label="username" onChange={this.handleChange} value={username} type="text" id="username" name="username" className="form-control" placeholder="username" required autoFocus />
              <div className="help-block with-errors" />
            </FormGroup>

            <FormGroup key="password">
              <label htmlFor="inputPassword" className="sr-only">Password</label>
              <FormControl aria-label="password" onChange={this.handleChange} value={password} type="password" id="password" name="password" className="form-control" placeholder="Password" required />
            </FormGroup>

            <FormGroup key="remember">
              <input onChange={this.handleChange} type="checkbox" id="remember_me" name="remember_me" />
              <label htmlFor="remember_me">Remember me</label>

              <Link to="/_forgot" onClick={closeLogin} style={{ float: 'right' }}>Forgot password or username?</Link>
            </FormGroup>
            {
              auth.getIn(['user', 'anon']) && auth.getIn(['user', 'num_collections']) > 0 &&
                <TempUsage
                  handleInput={this.handleChange}
                  moveTemp={moveTemp}
                  toColl={toColl} />
            }
            <Button bsSize="lg" bsStyle="primary" type="submit" block>Sign in</Button>
          </Form>
        </Row>
        {
          anonCTA &&
            <div className="anon-cta">
              <h5>New to {product}? <Link to="/_register" onClick={closeLogin}>Sign up &raquo;</Link></h5>
              <h5>Or <Button onClick={closeLogin} className="button-link">continue as guest &raquo;</Button></h5>
              <span className="info">Guest sessions are limited to {guestSessionTimeout}.</span>
            </div>
        }
      </React.Fragment>
    );
  }
}

export default LoginForm;
