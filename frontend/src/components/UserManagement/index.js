import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { browserHistory, Link } from 'react-router';

import Modal from 'components/Modal';

import LoginForm from './forms';
import './style.scss';

export class UserManagement extends Component {

  static propTypes = {
    auth: PropTypes.shape({
      username: PropTypes.string,
      role: PropTypes.string,
      loggingIn: PropTypes.bool,
      loggingOut: PropTypes.bool
    }),
    loginFn: PropTypes.func.isRequired,
    logoutFn: PropTypes.func.isRequired
  }

  static defaultProps = {
    auth: {
      username: null,
      role: null
    }
  }

  constructor(props) {
    super(props);

    this.state = {
      showModal: false
    };
  }

  componentWillReceiveProps(nextProps) {
    if(this.props.auth.loggingOut && !nextProps.auth.loggingOut)
      setTimeout(() => browserHistory.push('/'), 500);

    if(this.props.auth.loggingIn && !nextProps.auth.loggingIn) {
      if(typeof nextProps.auth.loginError === 'undefined') {
        this.closeLogin();
        setTimeout(() => browserHistory.push('/'), 500);
      } else {
        this.setState({ formError: true });
      }
    }
  }

  showLogin = () => {
    this.setState({ showModal: true });
  }

  closeLogin = () => {
    this.setState({ showModal: false, formError: false });
  }

  save = (data) => {
    this.setState({ formError: false });
    this.props.loginFn(data);
  }

  render() {
    const { auth, logoutFn } = this.props;
    const { showModal, formError } = this.state;

    const form = <LoginForm cb={this.save} error={formError} />;

    return (
      <div className="navbar-user-links navbar-right">
        { !auth.loaded || !auth.user.username ?
          <ul className="nav">
            <li className="navbar-right">
              <button className="login-link wr-header-btn" onClick={this.showLogin}>Login</button>
            </li>
            <li className="navbar-right">
              <Link to="/_register">Sign Up</Link>
            </li>
          </ul> :
          <ul className="nav">
            <li className="navbar-text navbar-right">
              <button className="wr-header-btn" title="Logout" onClick={logoutFn}>
                <span className="glyphicon glyphicon-log-out" title="Logout" />
              </button>
            </li>

            <li className="navbar-text navbar-right">
              <Link to={`/${auth.user.username}/_settings`} >
                <span className="glyphicon glyphicon-cog right-buffer-sm" />
              </Link>
            </li>

            <li className="navbar-text navbar-right">
              <Link to={`/${auth.user.username}`} >
                <span className="glyphicon glyphicon-user right-buffer-sm" />{ auth.user.username }
              </Link>
            </li>

            {
              auth.user.role === 'admin' &&
                <li className="navbar-text navbar-right">
                  <Link to="/admin/">
                    <span className="glyphicon glyphicon-wrench right-buffer-sm" />admin
                  </Link>
                </li>
            }
          </ul>
        }
        <Modal header={'Webrecorder Login'} body={form} visible={showModal} closeCb={this.closeLogin} />
      </div>
    );
  }
}

export default UserManagement;
