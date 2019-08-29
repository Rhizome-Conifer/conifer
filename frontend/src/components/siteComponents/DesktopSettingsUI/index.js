import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import {
  Button,
  Col,
  ControlLabel,
  FormControl,
  FormGroup,
  InputGroup,
  Panel,
  ProgressBar,
  Row
} from 'react-bootstrap';

import { supportEmail } from 'config';
import { appendFlashVersion } from 'helpers/utils';

import Modal from 'components/Modal';
import SizeFormat from 'components/SizeFormat';
import { LoaderIcon } from 'components/icons';

import './style.scss';

const { ipcRenderer, shell } = window.require('electron');


class DesktopSettingsUI extends Component {
  static propTypes = {
    auth: PropTypes.object,
    collSum: PropTypes.number,
    deleting: PropTypes.bool,
    deleteError: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.object
    ]),
    match: PropTypes.object,
    user: PropTypes.object
  };

  constructor(props) {
    super(props);

    this.state = {
      allotment: '',
      confirmUser: '',
      dataPath: '',
      showModal: false,
      version: ''
    };
  }

  componentWillMount() {
    ipcRenderer.on('async-response', this.handleVersionResponse);
    ipcRenderer.send('async-call');
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('async-response', this.handleVersionResponse);
  }

  handleChange = evt => this.setState({ [evt.target.name]: evt.target.value })

  handleVersionResponse = (evt, arg) => {
    const { dataPath, version } = arg.config;
    this.setState({ dataPath, version: appendFlashVersion(version) });
  }

  openDataDir = () => {
    shell.openItem(this.state.dataPath);
  }

  sendDelete = (evt) => {
    if (this.validateConfirmDelete() === 'success') {
      this.props.deleteUser(this.props.auth.getIn(['user', 'username']));
    }
  }

  toggleDelete = evt => this.setState({ showModal: !this.state.showModal })

  closeDeleteModal = evt => this.setState({ showModal: false })

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

  render() {
    const { deleting, match: { params }, user } = this.props;
    const { showModal } = this.state;

    const username = params.user;

    const usedSpace = user.getIn(['space_utilization', 'used']);
    const totalSpace = user.getIn(['space_utilization', 'total']);

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
      <div className="row col-xs-10 col-xs-push-1 space-block desktop-settings">
        <Helmet>
          <title>{`${username}'s Account Settings`}</title>
        </Helmet>

        <div className="row top-buffer main-logo">
          <h1>Webrecorder</h1>
        </div>
        <div className="row tagline">
          <h4 className="text-center">Desktop App</h4>
        </div>

        <Panel>
          <Panel.Heading>
            <Panel.Title>Version Info</Panel.Title>
          </Panel.Heading>
          <Panel.Body>
            <p dangerouslySetInnerHTML={{ __html: this.state.version || 'Loading...' }} />
          </Panel.Body>
        </Panel>

        <Panel>
          <Panel.Heading>
            <Panel.Title>Usage for <b>{ username }</b></Panel.Title>
          </Panel.Heading>
          <Panel.Body>
            <span><b>Data Directory:</b></span>
            <p>
              <button onClick={this.openDataDir} className="button-link" type="button">{this.state.dataPath}</button>
            </p>
            <span><b>Space Used:</b> </span>
            <SizeFormat bytes={usedSpace} /> <em>of <SizeFormat bytes={totalSpace} /></em>
            <ProgressBar now={(usedSpace / totalSpace) * 100} bsStyle="success" />
          </Panel.Body>
        </Panel>

        {/*
          <Panel className="buffer-top" bsStyle="danger">
            <Panel.Heading>
              <Panel.Title>Remove Local Data</Panel.Title>
            </Panel.Heading>
            <Panel.Body>
              <div className="row col-md-12">
                <div>
                  <b>Permanently remove all local archived data for this user</b>
                  <p>This action can not be undone!</p>
                  <Button bsStyle="danger" bsSize="sm" onClick={this.toggleDelete}>Clear Local Data</Button>
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
          */}
      </div>
    );
  }
}

export default DesktopSettingsUI;
