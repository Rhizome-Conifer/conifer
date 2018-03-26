import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Button, ControlLabel, Form,
         FormControl, FormGroup } from 'react-bootstrap';


class ResetPasswordUI extends Component {
  static propTypes = {
    cb: PropTypes.func,
    errors: PropTypes.object
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
    const { email, username } = this.state;
    evt.preventDefault();

    if (email && username) {
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
    const { username, email } = this.state;

    return (
      <div className="row">
        <div className="col-sm-6 col-md-4 col-md-offset-4">
          <Form onSubmit={this.save}>
            <h3>Password Recovery</h3>
            <h4>Please enter either your e-mail address and/or username to request a password reset.</h4>

            <FormGroup validationState={this.validateItem('username')}>
              <ControlLabel>Username</ControlLabel>
              <FormControl
                type="text"
                name="username"
                placeholder="Username"
                value={username}
                onChange={this.handleChange}
                autoFocus />
            </FormGroup>

            <FormGroup validationState={this.validateItem('email')}>
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

export default ResetPasswordUI;
