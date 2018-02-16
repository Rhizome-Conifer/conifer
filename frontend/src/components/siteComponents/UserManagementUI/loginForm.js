import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { Alert, Button, Col, Form, FormGroup,
         FormControl, Row } from 'react-bootstrap';

import config from 'config';

import { TempUsage } from 'containers';


class LoginForm extends Component {
  static propTypes = {
    auth: PropTypes.object,
    cb: PropTypes.func,
    error: PropTypes.bool,
    closeLogin: PropTypes.func
  };

  constructor(props) {
    super(props);

    this.state = {
      moveTemp: false,
      toColl: '',
      username: '',
      password: ''
    };
  }

  save = (evt) => {
    evt.preventDefault();

    const stateData = this.state;

    if (stateData.hasOwnProperty('remember_me')) {
      stateData.remember_me = String(Number(stateData.remember_me));
    }

    this.props.cb(stateData);
  }

  validateUsername = () => {
    const pattern = config.userRegex;
    if(typeof this.state.username !== 'undefined')
      return this.state.username.match(pattern) === this.state.username ? null : 'warning';
    return null;
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

  render() {
    const { auth, closeLogin, error } = this.props;
    const { moveTemp, password, toColl, username } = this.state;

    return (
      <Row className="wr-login-form">
        <Col md={12} >
          {
            error &&
              <Alert bsStyle="danger" >
                Invalid Login. Please Try Again
              </Alert>
          }
          <Form id="loginform" onSubmit={this.save}>
            <FormGroup
              key="username">
              <label htmlFor="username" className="sr-only">Username</label>
              <FormControl onChange={this.handleChange} value={username} type="text" id="username" name="username" className="form-control" placeholder="username" required data-error="This is not a valid username. If you forgot your username, please use the 'Forgot password or username' link to reset it." autoFocus />
              <div className="help-block with-errors" />
            </FormGroup>

            <FormGroup key="password">
              <label htmlFor="inputPassword" className="sr-only">Password</label>
              <FormControl onChange={this.handleChange} value={password} type="password" id="password" name="password" className="form-control" placeholder="Password" required />
            </FormGroup>

            <FormGroup key="remember">
              <input onChange={this.handleChange} type="checkbox" id="remember_me" name="remember_me" />
              <label htmlFor="remember_me">Stay Logged-In</label>
            </FormGroup>
            {
              auth.getIn(['user', 'anon']) && auth.getIn(['user', 'coll_count']) > 0 &&
                <TempUsage
                  handleInput={this.handleChange}
                  moveTemp={moveTemp}
                  toColl={toColl} />
            }
            <Button bsSize="lg" bsStyle="primary" type="submit" block>Login</Button>
          </Form>
          <p><Link to="/_forgot" onClick={closeLogin}>Forgot password or username?</Link></p>
        </Col>
      </Row>
    );
  }
}

export default LoginForm;
