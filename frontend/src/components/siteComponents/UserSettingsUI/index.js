import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import {
  Alert,
  Button,
  ControlLabel,
  Dropdown,
  FormControl,
  FormGroup,
  HelpBlock,
  InputGroup,
  MenuItem,
  Panel,
  ProgressBar
} from 'react-bootstrap';

import { defaultCollDesc, product, supporterPortal } from 'config';
import { passwordPassRegex } from 'helpers/utils';

import HttpStatus from 'components/HttpStatus';
import Modal from 'components/Modal';
import SizeFormat from 'components/SizeFormat';
import WYSIWYG from 'components/WYSIWYG';
import { CheckIcon, DisabledIcon, LoaderIcon, TrashIcon, UserIcon } from 'components/icons';

import './style.scss';


class UserSettingsUI extends Component {
  static propTypes = {
    auth: PropTypes.object,
    collSum: PropTypes.number,
    deleting: PropTypes.bool,
    deleteError: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object
    ]),
    deleteUser: PropTypes.func,
    edited: PropTypes.bool,
    editing: PropTypes.bool,
    editUser: PropTypes.func,
    loadUserRoles: PropTypes.func,
    match: PropTypes.object,
    updatePass: PropTypes.func,
    adminUpdateUser: PropTypes.func,
    user: PropTypes.object
  };

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.match.params.user !== prevState.user) {
      return {
        allotment: '',
        user: nextProps.match.params.user
      };
    }

    if (nextProps.auth && nextProps.auth.get('passUpdate')) {
      return {
        currPassword: '',
        password: '',
        password2: ''
      };
    }

    return null;
  }

  constructor(props) {
    super(props);

    this.state = {
      allotment: '',
      confirmUser: '',
      currPassword: '',
      desc: props.user.get('desc'),
      display_url: props.user.get('display_url'),
      full_name: props.user.get('full_name'),
      password: '',
      password2: '',
      role: null,
      showModal: false
    };
  }

  componentDidMount() {
    const { auth } = this.props;
    if (auth.getIn(['user', 'role']) === 'admin') {
      this.props.loadUserRoles();
    }
  }

  handleChange = evt => this.setState({ [evt.target.name]: evt.target.value })

  goToSupporterPortal = () => {
    window.location.href = supporterPortal;
  }

  toggleDelete = evt => this.setState({ showModal: !this.state.showModal })

  closeDeleteModal = evt => this.setState({ showModal: false })

  editDesc = (desc) => {
    this.setState({ desc });
  }

  setRole = (role) => {
    this.setState({ role });
  }

  saveRole = () => {
    const { match: { params: { user } }, adminUpdateUser } = this.props;
    const { role } = this.state;
    adminUpdateUser(user, { role });
  }

  send = (evt) => {
    evt.preventDefault();
    const { currPassword, password, password2 } = this.state;

    if (!password || !password2) {
      this.setState({ missingPw: true });
    }

    if (this.validatePassword() === null) {
      this.props.updatePass(currPassword, password, password2);
    }
  }

  sendDelete = (evt) => {
    if (this.validateConfirmDelete() === 'success') {
      this.props.deleteUser(this.props.auth.getIn(['user', 'username']));
    }
  }

  updateUserAllotment = () => {
    const { match: { params: { user } }, adminUpdateUser } = this.props;
    const { allotment } = this.state;

    if (allotment && this.validateAllotment() === null) {
      adminUpdateUser(user, { max_size: parseFloat(allotment) * 1000000000 });
    }
  }

  updateUserDetails = (evt) => {
    evt.preventDefault();
    const { match: { params: { user } }, editUser } = this.props;
    const { desc, display_url, full_name } = this.state;

    editUser(user, {
      desc,
      display_url,
      full_name
    });
  }

  validateAllotment = () => {
    const { user } = this.props;
    const { allotment } = this.state;

    if (allotment && parseFloat(allotment) * 1000000000 <= user.getIn(['space_utilization', 'used'])) {
      return 'error';
    }

    return null;
  }

  validateConfirmDelete = (evt) => {
    const { auth } = this.props;
    const { confirmUser } = this.state;

    if (!confirmUser) {
      return null;
    }

    if (auth.getIn(['user', 'username']).toLowerCase() !== confirmUser.toLowerCase()) {
      return 'error';
    }

    return 'success';
  }

  validatePassword = () => {
    const { password, password2, missingPw } = this.state;

    if (password && !passwordPassRegex(password)) {
      return 'warning';
    }

    if ((password && password2 && password !== password2) || missingPw) {
      return 'error';
    }

    return null;
  }

  render() {
    const { auth, deleting, edited, editing, match: { params }, user } = this.props;
    const { currPassword, password, password2, showModal } = this.state;

    const username = params.user;
    const canAdmin = username === auth.getIn(['user', 'username']);
    const superuser = auth.getIn(['user', 'role']) === 'admin';

    if ((!superuser && !canAdmin) || user.getIn(['error', 'error']) === 'no_such_user') {
      return <HttpStatus />;
    }

    const usedSpace = user.getIn(['space_utilization', 'used']);
    const totalSpace = user.getIn(['space_utilization', 'total']);
    const passUpdate = auth.get('passUpdate');
    const passUpdateFail = auth.get('passUpdateFail');

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
            aria-label="confirm user"
            autoFocus
            disabled={deleting}
            id="confirm-delete"
            name="confirmUser"
            onChange={this.handleChange}
            placeholder={username}
            type="text"
            value={this.state.confirmUser} />
        </FormGroup>
      </div>
    );
    const confirmDeleteFooter = (
      <div>
        <button onClick={this.closeDeleteModal} disabled={deleting} type="button" className="btn btn-default">Cancel</button>
        <button onClick={this.sendDelete} disabled={deleting || this.validateConfirmDelete() !== 'success'} className="btn btn-danger btn-ok" type="button">
          {
            deleting &&
              <LoaderIcon />
          }
          Confirm Delete
        </button>
      </div>
    );

    return (
      <div className="row top-buffer col-xs-10 col-xs-push-1 col-md-8 col-md-push-2 space-block user-settings">
        <Helmet>
          <title>{`${username}'s Account Settings`}</title>
        </Helmet>
        {
          superuser &&
            <Panel>
              <Panel.Heading>
                <Panel.Title>Administrator Settings</Panel.Title>
              </Panel.Heading>
              <Panel.Body>
                Only administrators of {product} can access this section.
                <div className="admin-options">
                  <div className="admin-section">
                    <h5>Allot Space</h5>
                    <span>Includes <SizeFormat bytes={user.get('customer_max_size')} /> paid storage.</span>
                    <FormGroup validationState={this.validateAllotment()} className="top-buffer-md">
                      <InputGroup>
                        <FormControl
                          id="increaseSpace"
                          name="allotment"
                          onChange={this.handleChange}
                          placeholder={totalSpace / 1000000000}
                          type="text"
                          value={this.state.allotment} />
                        <InputGroup.Addon>GB</InputGroup.Addon>
                      </InputGroup>
                      <Button className="top-buffer-md rounded" bsSize="sm" onClick={this.updateUserAllotment}>Update Allotment</Button>
                    </FormGroup>
                  </div>

                  <div className="admin-section update-role">
                    <h5>Update Role</h5>
                    <p>Current Role: {user.get('role')}</p>
                    <div>
                      <Dropdown id="roleDropdown" onSelect={this.setRole}>
                        <Dropdown.Toggle>{this.state.role ? this.state.role : 'Change Role'}</Dropdown.Toggle>
                        <Dropdown.Menu>
                          {
                            auth.get('roles').map(role => <MenuItem key={role} eventKey={role}>{role}</MenuItem>)
                          }
                        </Dropdown.Menu>
                      </Dropdown>
                    </div>
                    <Button className="top-buffer-md rounded" bsSize="sm" onClick={this.saveRole}>Update Role</Button>
                  </div>

                  <div className="admin-section suspend">
                    <h5>Suspend Account</h5>
                    <p>User will be suspended and a notification will be sent via email.</p>
                    <Button className="rounded" disabled><DisabledIcon /> Suspend Account</Button>
                  </div>
                </div>
              </Panel.Body>
            </Panel>
        }

        <div className="settings-block">
          <h3>Storage</h3>
          {
            supporterPortal && user.get('customer_id') &&
              <h4>Contributing Supporter Account</h4>
          }
          <span>Space Used: </span>
          <SizeFormat bytes={usedSpace} /> <em>of <SizeFormat bytes={totalSpace} /></em>
          <ProgressBar now={(usedSpace / totalSpace) * 100} />
          {
            supporterPortal &&
              <React.Fragment>
                {
                  user.get('customer_id') ?
                    <React.Fragment>
                      <p>Thank you, your support makes Webrecorder possibile. <a href="#">Learn more about our sustainability strategy.</a></p>
                      <Button className="rounded" onClick={this.goToSupporterPortal}>Manage Billing and Subscription</Button>
                    </React.Fragment> :
                    <div className="upgrade">
                      <div>
                        <a href={supporterPortal} target="_blank">Upgrade for more storage.</a><br />
                        <span>Supporter plans starting at $20/month</span>
                      </div>
                      <Button className="rounded" onClick={this.goToSupporterPortal}>See Available Plans</Button>
                    </div>
                }
              </React.Fragment>
          }
        </div>

        <div className="settings-block profile">
          <h3>Public Profile</h3>
          <div className="username">
            <UserIcon /> {user.get('username')}
          </div>
          <form id="update-user" onSubmit={this.updateUserDetails}>
            <div className="form-group">
              <label htmlFor="display-name">Display Name</label>
              <input
                id="display-name"
                className="form-control input-sm"
                onChange={this.handleChange}
                name="full_name"
                value={this.state.full_name} />
              <div className="help-block with-errors" />
            </div>

            <div className="form-group">
              <label htmlFor="display-url">URL</label>
              <input
                id="display-url"
                className="form-control input-sm"
                onChange={this.handleChange}
                name="display_url"
                value={this.state.display_url} />
              <div className="help-block with-errors" />
            </div>

            <div className="form-group">
              <label>About</label>
              <WYSIWYG
                editMode
                externalEditButton
                contentSync={this.editDesc}
                initial={user.get('desc') || ''}
                placeholder={defaultCollDesc} />
            </div>
            <Button className="rounded" type="submit" disabled={editing}>{(editing || edited) && (edited ? <CheckIcon success /> : <LoaderIcon />)}Update Profile</Button>
          </form>
        </div>

        <div className="settings-block security">
          <h3>Security</h3>
          <div className="account-email">
            <h5>Account Email</h5>
            {user.get('email_addr')}
          </div>
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
          <form id="changepassword" onSubmit={this.send}>
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
                aria-label="password"
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
                aria-label="confirm password"
                type="password"
                name="password2"
                value={password2}
                onChange={this.handleChange} />
              {
                password && password2 && password !== password2 &&
                  <HelpBlock>Password confirmation does not match</HelpBlock>
              }
            </FormGroup>
            <Button className="rounded" bsSize="sm" disabled={!canAdmin} type="submit">Update Password</Button>
          </form>
        </div>

        <Panel className="buffer-top" bsStyle="danger">
          <Panel.Heading>
            <Panel.Title>Delete Account</Panel.Title>
          </Panel.Heading>
          <Panel.Body>
            <div className="row col-md-12">
              <div>
                <b>Permanently delete this account and all archived data for this user</b>
                <p>This action <u>can not</u> be undone!</p>
                <Button bsStyle="danger" className="rounded" bsSize="sm" disabled={!canAdmin} onClick={this.toggleDelete}><TrashIcon /> Delete Account</Button>
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
