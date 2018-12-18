import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ControlLabel, FormControl, FormGroup, Button } from 'react-bootstrap';

import { product } from 'config';

import Modal from 'components/Modal';

import LoginForm from './loginForm';
import './style.scss';


class UserManagementUI extends Component {
  static propTypes = {
    anonCTA: PropTypes.bool,
    auth: PropTypes.object,
    history: PropTypes.object,
    loginFn: PropTypes.func.isRequired,
    next: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
    open: PropTypes.bool,
    sendUIReport: PropTypes.func,
    showModal: PropTypes.func,
    toggleBugModal: PropTypes.func,
    uiBug: PropTypes.bool
  };

  constructor(options) {
    super(options);

    this.state = {
      desc: '',
      formError: null,
      email: ''
    };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.auth.get('loggingIn') && !nextProps.auth.get('loggingIn')) {
      if (!nextProps.auth.get('loginError')) {
        //this.closeLogin();
        if (this.state.formError) {
          this.setState({ formError: false });
        }

        this.props.history.push(
          this.props.next !== null ? this.props.next : `/${nextProps.auth.getIn(['user', 'username'])}`
        );
      } else {
        this.setState({ formError: true });
      }
    }
  }

  showLogin = () => {
    this.props.showModal(true);
  }

  closeLogin = () => {
    this.props.showModal(false);
    this.setState({ formError: false });
  }

  handleInput = (evt) => {
    this.setState({ [evt.target.name]: evt.target.value });
  }

  save = (data) => {
    this.setState({ formError: false });
    this.props.loginFn(data);
  }

  sendBugReport = () => {
    const { desc, email } = this.state;
    if (desc) {
      this.props.sendUIReport({ desc, email, url: window.location.href });
      this.toggleBugModal();
    }
  }

  toggleBugModal = () => {
    this.props.toggleBugModal(!this.props.uiBug);
  }

  render() {
    const { anonCTA, auth, open } = this.props;
    const { formError } = this.state;

    const collCount = auth.getIn(['user', 'num_collections']);
    const form = (
      <LoginForm
        anonCTA={anonCTA}
        auth={auth}
        cb={this.save}
        error={formError}
        closeLogin={this.closeLogin} />
    );
    const username = auth.getIn(['user', 'username']);
    const isAnon = auth.getIn(['user', 'anon']);

    return (
      <React.Fragment>
        <ul className="navbar-user-links">
          { !auth.get('loaded') || !username || isAnon ?
            <React.Fragment>
              <li className="navbar-right">
                <button className="login-link wr-header-btn" onClick={this.showLogin} type="button">Login</button>
              </li>
              <li className="navbar-right">
                <Link to="/_register">Sign Up</Link>
              </li>
            </React.Fragment> :
            <li className="navbar-text navbar-right">
              <Link to="/_logout" className="wr-header-btn" title="Logout">
                <span className="glyphicon glyphicon-log-out" title="Logout" />
                <span className="visible-xs">Log out</span>
              </Link>
            </li>
          }

          {
            isAnon === false &&
              <li className="navbar-text navbar-right">
                <Link to={`/${username}/_settings`}>
                  <span className="glyphicon glyphicon-user right-buffer-sm" />{ username }
                </Link>
              </li>
          }

          {
            (isAnon === false || (isAnon && collCount > 0)) &&
              <li className="navbar-text navbar-right">
                <Link to={isAnon ? `/${username}/temp/manage` : `/${username}`}>
                  {
                    isAnon ?
                      <React.Fragment>Temporary Collection</React.Fragment> :
                      <React.Fragment>My Collections<span className="num-collection">{ collCount }</span></React.Fragment>
                  }
                </Link>
              </li>
          }

          {/*
            auth.getIn(['user', 'role']) === 'admin' &&
              <li className="navbar-text navbar-right">
                <Link to="/admin/">
                  <span className="glyphicon glyphicon-wrench right-buffer-sm" />admin
                </Link>
              </li>
          */}

          <li className="navbar-text navbar-right">
            <button onClick={this.toggleBugModal} className="borderless custom-report" type="button">Submit a bug</button>
            <Modal
              dialogClassName="ui-bug-modal"
              header="Submit a UI bug"
              visible={this.props.uiBug}
              closeCb={this.toggleBugModal}
              footer={<React.Fragment><Button onClick={this.toggleBugModal}>Cancel</Button><Button bsStyle="primary" onClick={this.sendBugReport}>Submit</Button></React.Fragment>}>
              <p>Spot something off? Let us know what's happening:</p>
              <FormGroup>
                <FormControl aria-label="description" componentClass="textarea" name="desc" placeholder="When I click the 'save' button when editing my collection description, nothing happens." onChange={this.handleInput} value={this.state.bugReport} />
              </FormGroup>
              <FormGroup>
                <ControlLabel>Email to notify in response to this issue: (optional)</ControlLabel>
                <FormControl aria-label="email" name="email" placeholder="me@example.com" onChange={this.handleInput} value={this.state.email} />
              </FormGroup>
            </Modal>
          </li>
        </ul>
        <Modal
          dialogClassName="wr-login-modal"
          header={anonCTA ? null : `${product} Login`}
          body={form}
          visible={open}
          closeCb={this.closeLogin} />
      </React.Fragment>
    );
  }
}

export default UserManagementUI;
