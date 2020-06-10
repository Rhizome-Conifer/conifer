import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';
import {
  Alert,
  Button,
  Card,
  Col,
  Dropdown,
  Form,
  InputGroup,
  ProgressBar,
  Row
} from 'react-bootstrap';

import { defaultCollDesc, product, supporterPortal } from 'config';
import { passwordPassRegex } from 'helpers/utils';
import { AccessContext } from 'store/contexts';
import { settings as settingsErr } from 'helpers/userMessaging';

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
    if (this.validateConfirmDelete()) {
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
      return false;
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
      return false;
    }

    return true;
  }

  validatePassword = () => {
    const { password, password2, missingPw } = this.state;

    if (password && !passwordPassRegex(password)) {
      return false;
    }

    if ((password && password2 && password !== password2) || missingPw) {
      return false;
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
        <Form.Group>
          <Form.Label>Type your username to confirm:</Form.Label>
          <Form.Control
            aria-label="confirm user"
            autoFocus
            disabled={deleting}
            id="confirm-delete"
            name="confirmUser"
            onChange={this.handleChange}
            placeholder={username}
            type="text"
            value={this.state.confirmUser}
            isInvalid={this.validateConfirmDelete() === false} />
        </Form.Group>
      </div>
    );
    const confirmDeleteFooter = (
      <div>
        <Button variant="outline-secondary" onClick={this.closeDeleteModal} disabled={deleting} type="button">Cancel</Button>
        <Button variant="danger" className="left-buffer-md" onClick={this.sendDelete} disabled={deleting || !this.validateConfirmDelete()}>
          {
            deleting &&
              <LoaderIcon />
          }
          Confirm Delete
        </Button>
      </div>
    );

    return (
      <AccessContext.Provider value={{ canAdmin }}>
        <Row className="top-buffer user-settings">
          <Helmet>
            <title>{`${username}'s Account Settings`}</title>
          </Helmet>
          <Col xs={{ span: 12 }} lg={{ span: 8, offset: 2}}>
            {
              superuser &&
                <Card>
                  <Card.Header>
                    <Card.Title>Administrator Settings</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    Only administrators of {product} can access this section.
                    <div className="admin-options">
                      <div className="admin-section">
                        <h5>Allot Space</h5>
                        <span>Includes <SizeFormat bytes={user.get('customer_max_size')} /> paid storage.</span>
                        <Form.Group className="top-buffer-md">
                          <InputGroup>
                            <Form.Control
                              id="increaseSpace"
                              name="allotment"
                              onChange={this.handleChange}
                              placeholder={totalSpace / 1000000000}
                              type="text"
                              isInvalid={this.validateAllotment() === false}
                              value={this.state.allotment} />
                            <InputGroup.Append>
                              <InputGroup.Text>GB</InputGroup.Text>
                            </InputGroup.Append>
                          </InputGroup>
                          <Button variant="primary" className="top-buffer" onClick={this.updateUserAllotment}>Update Allotment</Button>
                        </Form.Group>
                      </div>

                      <div className="admin-section update-role">
                        <h5>Update Role</h5>
                        <p>Current Role: {user.get('role')}</p>
                        <div>
                          <Dropdown id="roleDropdown" onSelect={this.setRole}>
                            <Dropdown.Toggle variant="outline-secondary">{this.state.role ? this.state.role : 'Change Role'}</Dropdown.Toggle>
                            <Dropdown.Menu>
                              {
                                auth.get('roles').map(role => <Dropdown.Item key={role} eventKey={role}>{role}</Dropdown.Item>)
                              }
                            </Dropdown.Menu>
                          </Dropdown>
                        </div>
                        <Button variant="primary" className="top-buffer" onClick={this.saveRole}>Update Role</Button>
                      </div>

                      <div className="admin-section suspend">
                        <h5>Suspend Account</h5>
                        <p>User will be suspended and a notification will be sent via email.</p>
                        <Button variant="primary" disabled><DisabledIcon /> Suspend Account</Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
            }

            <div className="settings-block top-buffer">
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
                          <p>Thank you, your support makes {product} possibile.</p>
                          <Button variant="primary" onClick={this.goToSupporterPortal}>Manage Billing and Subscription</Button>
                        </React.Fragment> :
                        <div className="upgrade">
                          <div>
                            <a href={supporterPortal} target="_blank">Upgrade for more storage.</a><br />
                            <span>Supporter plans starting at $20/month</span>
                          </div>
                          <Button variant="primary" onClick={this.goToSupporterPortal}>See Available Plans</Button>
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
              <Form id="update-user" onSubmit={this.updateUserDetails}>
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
                <Button size="lg" variant="primary" type="submit" disabled={editing}>{(editing || edited) && (edited ? <CheckIcon success /> : <LoaderIcon />)}Update Profile</Button>
              </Form>
            </div>

            <div className="settings-block security">
              <h3>Security</h3>
              <div className="account-email">
                <h5>Account Email</h5>
                {user.get('email_addr')}
              </div>
              {
                passUpdateFail &&
                  <Alert variant="danger">
                    {settingsErr[passUpdateFail] || 'Error encountered'}
                  </Alert>
              }
              {
                passUpdate &&
                  <Alert variant="success">
                    Password successfully updated
                  </Alert>
              }
              <Form id="changepassword" onSubmit={this.send}>
                <div className="form-group">
                  <label htmlFor="curr_password">Current Password</label>
                  <Form.Control
                    required
                    type="password"
                    id="curr_password"
                    name="currPassword"
                    onChange={this.handleChange}
                    value={currPassword} />
                  <div className="help-block with-errors" />
                </div>
                <Form.Group>
                  <Form.Label>New Password</Form.Label>
                  <Form.Control
                    required
                    aria-label="password"
                    type="password"
                    name="password"
                    value={password}
                    isInvalid={this.validatePassword() === false}
                    onChange={this.handleChange} />
                  <Form.Control.Feedback type="invalid">Password must be at least 8 characters and contain lower, uppercase, and either digits or symbols</Form.Control.Feedback>
                </Form.Group>

                <Form.Group>
                  <Form.Label>Confirm New Password</Form.Label>
                  <Form.Control
                    required
                    aria-label="confirm password"
                    type="password"
                    name="password2"
                    value={password2}
                    isInvalid={password2 && this.validatePassword() === false}
                    onChange={this.handleChange} />
                  <Form.Control.Feedback type="invalid">Password confirmation does not match</Form.Control.Feedback>
                </Form.Group>
                <Button size="lg" variant="primary" disabled={!canAdmin} type="submit">Update Password</Button>
              </Form>
            </div>

            <Card className="buffer-top" variant="danger">
              <Card.Header>
                <Card.Title>Delete Account</Card.Title>
              </Card.Header>
              <Card.Body>
                <div className="row col-md-12">
                  <div>
                    <b>Permanently delete this account and all archived data for this user</b>
                    <p>This action <u>can not</u> be undone!</p>
                    <Button size="lg" variant="danger" disabled={!canAdmin} onClick={this.toggleDelete}><TrashIcon /> Delete Account</Button>
                  </div>
                </div>
              </Card.Body>
            </Card>
            <Modal
              body={confirmDeleteBody}
              closeCb={this.closeDeleteModal}
              dialogClassName="wr-delete-modal"
              footer={confirmDeleteFooter}
              header="Confirm Delete Account?"
              visible={showModal} />
          </Col>
        </Row>
      </AccessContext.Provider>
    );
  }
}

export default UserSettingsUI;
