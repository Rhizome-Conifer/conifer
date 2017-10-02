import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { fromJS } from 'immutable';
import { Link } from 'react-router';

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
      anon: PropTypes.bool,
      coll_count: PropTypes.number,
      loggingIn: PropTypes.bool,
      loggingOut: PropTypes.bool
    }),
    loginFn: PropTypes.func.isRequired,
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
    if(this.props.auth.get('loggingIn') && !nextProps.auth.get('loggingIn')) {
      if(!nextProps.auth.get('loginError')) {
        this.closeLogin();
        setTimeout(() => this.context.router.replace('/'), 500);
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
    const { auth } = this.props;
    const { showModal, formError } = this.state;

    const collCount = auth.getIn(['user', 'coll_count']);
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
              <Link to="/_logout" className="wr-header-btn" title="Logout">
                <span className="glyphicon glyphicon-log-out" title="Logout" />
              </Link>
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
        <Modal header="Webrecorder Login" body={form} visible={showModal} closeCb={this.closeLogin} />
      </div>
    );
  }
}

export default UserManagementUI;
