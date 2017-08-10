import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, ControlLabel, Form,
         FormControl, FormGroup } from 'react-bootstrap';


class ResetPassword extends Component {
  static propTypes = {
    cb: PropTypes.func,
    errors: PropTypes.object
  };

  constructor(props) {
    super(props);

    this.state = {};
  }

  shouldComponentUpdate(nextProps, nextState) {
    if(nextProps.cb === this.props.cb)
      return false;

    return true;
  }

  save = (evt) => {
    evt.preventDefault();

    this.props.cb(this.state);
  }

  handleChange = (evt) => {
    this.setState({ [evt.target.name]: evt.target.value });
  }

  render() {
    const { username, email } = this.state;

    return (
      <div className="row">
        <div className="col-sm-6 col-md-4 col-md-offset-4">
          <Form onSubmit={this.save}>
            <h3>Password Recovery</h3>
            <h4>Please enter either your e-mail address and/or username to request a password reset.</h4>

            <FormGroup>
              <ControlLabel>Username</ControlLabel>
              <FormControl
                type="text"
                name="username"
                placeholder="Username"
                value={username}
                onChange={this.handleChange}
                autoFocus />
            </FormGroup>

            <FormGroup>
              <ControlLabel>Email</ControlLabel>
              <FormControl
                type="email"
                name="email"
                placeholder="Email"
                value={email}
                onChange={this.handleChange}
                autoFocus />
            </FormGroup>

            <Button bsStyle="primary" type="submit" block>Send Reset Email</Button>
          </Form>
        </div>
      </div>
    );
  }
}

export default ResetPassword;
