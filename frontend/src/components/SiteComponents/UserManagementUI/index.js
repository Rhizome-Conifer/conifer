import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { fromJS } from 'immutable';
import { browserHistory, Link } from 'react-router';

import Modal from 'components/Modal';

import LoginForm from './forms';
import './style.scss';

class UserManagementUI extends Component {

  static contextTypes = {
    router: PropTypes.object
  }

  static propTypes = {
    auth: PropTypes.shape({
      username: PropTypes.string,
      role: PropTypes.string,
      loggingIn: PropTypes.bool,
      loggingOut: PropTypes.bool
    }),
    collCount: PropTypes.number,
    loginFn: PropTypes.func.isRequired,
    logoutFn: PropTypes.func.isRequired
  }

  static defaultProps = fromJS({
    auth: {
      username: null,
      role: null
    }
  })

  constructor(props) {
    super(props);

    this.state = {
      showModal: false
    };
  }

  componentWillReceiveProps(nextProps) {
    if(this.props.auth.get('loggingOut') && !nextProps.auth.get('loggingOut'))
      setTimeout(() => this.context.router.push('/'), 500);

    if(this.props.auth.get('loggingIn') && !nextProps.auth.get('loggingIn')) {
      if(!nextProps.auth.get('loginError')) {
        this.closeLogin();
        setTimeout(() => this.context.router.push('/'), 500);
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
    const { auth, collCount, logoutFn } = this.props;
    const { showModal, formError } = this.state;

    const form = <LoginForm cb={this.save} error={formError} />;
    const username = auth.getIn(['user', 'username']);

    return (
      <div className="navbar-user-links navbar-right">
        { !auth.get('loaded') || !username ?
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
              <Link to={`/${username}/_settings`} >
                <span className="glyphicon glyphicon-user right-buffer-sm" />{ username }
              </Link>
            </li>

            <li className="navbar-text navbar-right">
              <Link to={`/${username}`} >
                My Collections<span className="num-collection">{ collCount }</span>
              </Link>
            </li>

            {
              auth.getIn(['user', 'role']) === 'admin' &&
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

export default UserManagementUI;
