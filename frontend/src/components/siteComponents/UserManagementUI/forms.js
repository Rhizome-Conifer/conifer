import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router';
import { Alert, Button, Col, Form, FormGroup,
         FormControl, Row } from 'react-bootstrap';

import config from 'config';


class LoginForm extends Component {

  static propTypes = {
    cb: PropTypes.func,
    formError: PropTypes.bool
  }

  static defaultProps = {
    formError: false
  }

  constructor(props) {
    super(props);

    this.state = {};
  }

  save = (evt) => {
    evt.preventDefault();

    this.props.cb(this.state);
  }

  validateUsername = () => {
    const pattern = config.userRegex;
    if(typeof this.state.username !== 'undefined')
      return this.state.username.match(pattern) === this.state.username ? null : 'warning';
    return null;
  }

  handleChange = (evt) => {
    this.setState({ [evt.target.name]: evt.target.value });
  }

  render() {
    const { error } = this.props;

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
              <FormControl onChange={this.handleChange} type="text" id="username" name="username" className="form-control" placeholder="username" required data-error="This is not a valid username. If you forgot your username, please use the 'Forgot password or username' link to reset it." autoFocus />
              <div className="help-block with-errors" />
            </FormGroup>

            <FormGroup key="password">
              <label htmlFor="inputPassword" className="sr-only">Password</label>
              <FormControl onChange={this.handleChange} type="password" id="password" name="password" className="form-control" placeholder="Password" required />
            </FormGroup>

            <FormGroup key="remember">
              <input onChange={this.handleChange} type="checkbox" id="remember_me" name="remember_me" />
              <label htmlFor="remember_me">Stay Logged-In</label>
            </FormGroup>
            {
              // include 'move_temp_form.html'
            }
            <Button bsSize="lg" bsStyle="primary" type="submit" block>Login</Button>
          </Form>
          <p><Link to="/_forgot" target="_top">Forgot password or username?</Link></p>
        </Col>
      </Row>
    );
  }
}

export default LoginForm;
