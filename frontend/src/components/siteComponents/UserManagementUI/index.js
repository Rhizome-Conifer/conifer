import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Raven from 'raven-js';
import { fromJS } from 'immutable';
import { Link } from 'react-router-dom';

import { product, ravenConfig } from 'config';

import Modal from 'components/Modal';

import LoginForm from './loginForm';
import './style.scss';


class UserManagementUI extends Component {

  static contextTypes = {
    router: PropTypes.object
  };

  static propTypes = {
    anonCTA: PropTypes.bool,
    auth: PropTypes.object,
    history: PropTypes.object,
    loginFn: PropTypes.func.isRequired,
    open: PropTypes.bool,
    showModal: PropTypes.func,
  };

  static defaultProps = fromJS({
    auth: {
      username: null,
      role: null
    }
  });

  constructor(options) {
    super(options);

    this.state = {
      formError: null
    };
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.auth.get('loggingIn') && !nextProps.auth.get('loggingIn')) {
      if (!nextProps.auth.get('loginError')) {
        this.closeLogin();
        //this.props.history.push(`/${nextProps.auth.getIn(['user', 'username'])}`);
        this.props.history.push('/');
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

  save = (data) => {
    this.setState({ formError: false });
    this.props.loginFn(data);
  }

  submitBugreport = () => {
    try {
      throw new Error('bugreport');
    } catch(e) {
      Raven.captureException(e);
      if (Raven.lastEventId()) {
        Raven.showReportDialog();
      }
    }
  }

  render() {
    const { anonCTA, auth, open } = this.props;
    const { formError } = this.state;

    const collCount = auth.getIn(['user', 'coll_count']);
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
      <div className="navbar-user-links navbar-right">
        <ul className="nav">
          { !auth.get('loaded') || !username || isAnon ?
            <React.Fragment>
              <li className="navbar-right">
                <button className="login-link wr-header-btn" onClick={this.showLogin}>Login</button>
              </li>
              <li className="navbar-right">
                <Link to="/_register">Sign Up</Link>
              </li>
            </React.Fragment> :
            <li className="navbar-text navbar-right">
              <Link to="/_logout" className="wr-header-btn" title="Logout">
                <span className="glyphicon glyphicon-log-out" title="Logout" />
              </Link>
            </li>
          }

          {
            isAnon === false &&
              <li className="navbar-text navbar-right">
                <Link to={`/${username}/_settings`} >
                  <span className="glyphicon glyphicon-user right-buffer-sm" />{ username }
                </Link>
              </li>
          }

          {
            (isAnon === false || (isAnon && collCount > 0)) &&
              <li className="navbar-text navbar-right">
                <Link to={isAnon ? `/${username}/temp` : `/${username}`} >
                  {
                    isAnon ?
                      <React.Fragment>Temporary Collection</React.Fragment> :
                      <React.Fragment>My Collections<span className="num-collection">{ collCount }</span></React.Fragment>
                  }
                </Link>
              </li>
          }

          {
            auth.getIn(['user', 'role']) === 'admin' &&
              <li className="navbar-text navbar-right">
                <Link to="/admin/">
                  <span className="glyphicon glyphicon-wrench right-buffer-sm" />admin
                </Link>
              </li>
          }

          {
            ravenConfig &&
              <li className="navbar-text navbar-right">
                <button onClick={this.submitBugreport} className="borderless custom-report">Submit a bug</button>
              </li>
          }
        </ul>
        <Modal
          dialogClassName="wr-login-modal"
          header={anonCTA ? false : `${product} Login`}
          body={form}
          visible={open}
          closeCb={this.closeLogin} />
      </div>
    );
  }
}

export default UserManagementUI;
