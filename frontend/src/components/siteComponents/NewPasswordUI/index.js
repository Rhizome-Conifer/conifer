import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import querystring from 'querystring';
import { Alert, Button, ControlLabel, Form, HelpBlock, FormControl, FormGroup } from 'react-bootstrap';

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
      newPass2: '',
      error: false
    };
  }

  save = (evt) => {
    evt.preventDefault();
    const { match: { params: { resetCode } } } = this.props;
    const { newPass, newPass2 } = this.state;

    if (newPass && newPass === newPass2) {
      this.setState({ error: false });
      this.props.setPassword({ newPass, newPass2, resetCode });
    } else {
      this.setState({ error: true });
    }
  }

  handleChange = (evt) => {
    this.setState({ [evt.target.name]: evt.target.value });
  }

  validateItem = () => {
    const { error, newPass, newPass2 } = this.state;

    if ((newPass && newPass2 && (newPass !== newPass2 || !passwordPassRegex(newPass))) || error) {
      return 'error';
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
            <Alert bsStyle={errors ? 'danger' : 'success'}>
              {
                errors ?
                  <span>{passwordResetErr[errors.get('error')]}</span> :
                  <span>Your password has been successfully reset! <button onClick={this.props.toggleLogin} className="button-link" type="button">You can now login with your new password.</button></span>
              }
            </Alert>
        }
        <div className={classNames('row new-pass', { success })}>
          <div className="col-sm-6 col-md-6 col-md-offset-3">
            <Form onSubmit={this.save}>
              <h3>{product} password reset</h3>
              <h4>Please enter a new password below:</h4>

              <div className="form-group">
                <p>Username: <b>{qs.username}</b></p>
              </div>

              <FormGroup validationState={this.validateItem()}>
                <ControlLabel>New password</ControlLabel>
                <FormControl
                  aria-label="new password"
                  type="password"
                  name="newPass"
                  placeholder="new password"
                  value={newPass}
                  onChange={this.handleChange}
                  autoFocus />
                {
                  this.validateItem() === 'error' && !passwordPassRegex(newPass) &&
                    <HelpBlock>Password must be at least 8 characters and contain lower, uppercase, and either digits or symbols</HelpBlock>
                }
              </FormGroup>

              <FormGroup validationState={this.validateItem()}>
                <ControlLabel>Repeat new password</ControlLabel>
                <FormControl
                  aria-label="repeat new password"
                  type="password"
                  name="newPass2"
                  placeholder="repeat new password"
                  value={newPass2}
                  onChange={this.handleChange} />
              </FormGroup>

              <Button bsStyle="primary" type="submit" disabled={success} block>Reset Password</Button>
            </Form>
          </div>
        </div>
      </React.Fragment>
    );
  }
}

export default NewPasswordUI;
