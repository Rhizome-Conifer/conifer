import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { Alert, ControlLabel, FormControl, FormGroup,
         HelpBlock, Panel, ProgressBar } from 'react-bootstrap';

import { supportEmail } from 'config';
import { passwordPassRegex } from 'helpers/utils';

import HttpStatus from 'components/HttpStatus';
import Modal from 'components/Modal';
import SizeFormat from 'components/SizeFormat';
import { LoaderIcon } from 'components/icons';

import './style.scss';


class UserSettingsUI extends Component {
  static propTypes = {
    collSum: PropTypes.number,
    deleting: PropTypes.bool,
    deleteError: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object
    ]),
    deleteUser: PropTypes.func,
    match: PropTypes.object,
    updatePass: PropTypes.func,
    user: PropTypes.object
  }

  constructor(props) {
    super(props);

    this.state = {
      confirmUser: '',
      currPassword: '',
      password: '',
      password2: '',
      showModal: false
    };
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.passUpdate) {
      this.setState({
        currPassword: '',
        password: '',
        password2: ''
      });
    }
  }

  handleChange = evt => this.setState({ [evt.target.name]: evt.target.value })

  sendDelete = (evt) => {
    if (this.validateConfirmDelete() === 'success') {
      this.props.deleteUser(this.props.user.get('username'));
    }
  }

  send = (evt) => {
    evt.preventDefault();
    const { currPassword, password, password2 } = this.state;

    if (!password || !password2) {
      this.setState({ missingPw: true });
    }

    if (this.validatePassword() === null)
      this.props.updatePass(currPassword, password, password2);
  }

  validatePassword = () => {
    const { password, password2, missingPw } = this.state;

    if (password && !passwordPassRegex(password))
      return 'warning';

    if ((password && password2 && password !== password2) || missingPw)
      return 'error';

    return null;
  }

  handleChange = (evt) => {
    this.setState({ [evt.target.name]: evt.target.value });
  }

  toggleDelete = evt => this.setState({ showModal: !this.state.showModal })
  closeDeleteModal = evt => this.setState({ showModal: false })

  validateConfirmDelete = (evt) => {
    const { user } = this.props;
    const { confirmUser } = this.state;

    if (!confirmUser) {
      return null;
    }

    if (user.get('username').toLowerCase() !== confirmUser.toLowerCase()) {
      return 'error';
    }

    return 'success';
  }

  render() {
    const { deleting, match: { params }, user } = this.props;
    const { currPassword, password, password2, showModal } = this.state;

    if (user.get('username') !== params.user) {
      return <HttpStatus />;
    }

    const usedSpace = user.getIn(['space_utilization', 'used']);
    const totalSpace = user.getIn(['space_utilization', 'total']);
    const passUpdate = user.get('passUpdate');
    const passUpdateFail = user.get('passUpdateFail');
    const username = user.get('username');

    const confirmDeleteBody = (
      <div>
        <p>
          Are you sure you want to delete the <b>{username}</b> account?
          If you continue, <b>all archived data in all collections will be permanently deleted.</b>
          You will need to re-register to use the service again.
        </p>
        <FormGroup validationState={this.validateConfirmDelete()}>
          <ControlLabel>Type your username to confirm:</ControlLabel>
          <FormControl
            autoFocus
            disabled={deleting}
            id="confirm-delete"
            name="confirmUser"
            onChange={this.handleChange}
            placeholder={user.get('username')}
            type="text"
            value={this.state.confirmUser} />
        </FormGroup>
      </div>
    );
    const confirmDeleteFooter = (
      <div>
        <button onClick={this.closeDeleteModal} disabled={deleting} type="button" className="btn btn-default">Cancel</button>
        <button onClick={this.sendDelete} disabled={deleting || this.validateConfirmDelete() !== 'success'} className="btn btn-danger btn-ok" >
          {
            deleting &&
              <LoaderIcon />
          }
          Confirm Delete
        </button>
      </div>
    );

    return (
      <div className="row top-buffer col-xs-10 col-xs-push-1 space-block">
        <Helmet>
          <title>{`${username}'s Account Settings`}</title>
        </Helmet>
        <Panel>
          <Panel.Heading>
            <Panel.Title>Usage for <b>{ username }</b></Panel.Title>
          </Panel.Heading>
          <Panel.Body>
            <span>Space Used: </span>
            <SizeFormat bytes={usedSpace} /> <em>of <SizeFormat bytes={totalSpace} /></em>
            <ProgressBar now={(usedSpace / totalSpace) * 100} bsStyle="success" />
            Please <a href={`mailto:${supportEmail}`}>contact us</a> if you would like to request additional space.
          </Panel.Body>
        </Panel>

        <Panel className="top-buffer">
          <Panel.Heading className="pw-reset">
            <Panel.Title>Change Password</Panel.Title>
            {
              !passUpdateFail &&
                <span>Enter your current password, and your new password below.</span>
            }
          </Panel.Heading>
          <Panel.Body>
            {
              passUpdateFail &&
                <Alert bsStyle="danger">
                  {passUpdateFail}
                </Alert>
            }
            {
              passUpdate &&
                <Alert bsStyle="success">
                  Password successfully updated
                </Alert>
            }
            <div className="row col-md-6">
              <form id="changepassword" onSubmit={this.send} role="form">
                <div className="form-group">
                  <label htmlFor="curr_password">Current Password</label>
                  <input
                    type="password"
                    id="curr_password"
                    name="currPassword"
                    className="form-control input-sm"
                    onChange={this.handleChange}
                    value={currPassword}
                    required />
                  <div className="help-block with-errors" />
                </div>


                <FormGroup validationState={this.validatePassword()}>
                  <ControlLabel>New Password</ControlLabel>
                  <FormControl
                    type="password"
                    name="password"
                    value={password}
                    onChange={this.handleChange} />
                  {
                    password && !passwordPassRegex(password) &&
                      <HelpBlock>Password must be at least 8 characters and contain lower, uppercase, and either digits or symbols</HelpBlock>
                  }
                </FormGroup>

                <FormGroup validationState={this.validatePassword()}>
                  <ControlLabel>Confirm New Password</ControlLabel>
                  <FormControl
                    type="password"
                    name="password2"
                    value={password2}
                    onChange={this.handleChange} />
                  {
                    password && password2 && password !== password2 &&
                      <HelpBlock>Password confirmation does not match</HelpBlock>
                  }
                </FormGroup>

                <button className="btn btn-primary btn-sm" type="submit">Change Password</button>
              </form>
            </div>
          </Panel.Body>
        </Panel>

        <Panel className="buffer-top" bsStyle="danger">
          <Panel.Heading>
            <Panel.Title>Delete Account</Panel.Title>
          </Panel.Heading>
          <Panel.Body>
            <div className="row col-md-12">
              <div>
                <b>Permanently delete this account and all archived data for this user</b>
                <p>This action can not be undone!</p>
                <button className="btn btn-sm btn-danger" onClick={this.toggleDelete}>Delete Account</button>
              </div>
            </div>
          </Panel.Body>
        </Panel>
        <Modal
          body={confirmDeleteBody}
          closeCb={this.closeDeleteModal}
          dialogClassName="wr-delete-modal"
          footer={confirmDeleteFooter}
          header="Confirm Delete Account?"
          visible={showModal} />
      </div>
    );
  }
}

export default UserSettingsUI;
