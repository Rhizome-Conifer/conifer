import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { asyncConnect } from 'redux-connect';

import { isLoaded as isAuthLoaded, load as loadAuth,
         login, logout } from 'redux/modules/auth';

import config from 'config';
import Breadcrumb from 'components/Breadcrumb';
import Footer from 'components/Footer';
import UserManagement from 'components/UserManagement';

import './style.scss';


// named export for tests
export class App extends Component { // eslint-disable-line

  static propTypes = {
    children: PropTypes.node.isRequired,
    auth: PropTypes.object,
    login: PropTypes.func,
    logout: PropTypes.func
  }

  logout = (evt) => {
    evt.preventDefault();
    this.props.logout();
  }

  login = (data) => {
    this.props.login(data);
  }

  render() {
    const { auth, routes } = this.props;

    return (
      <div className="wr-app">
        <Helmet {...config.app.head} />
        <header>
          <div className="navbar navbar-default navbar-static-top">
            <nav className="container-fluid header-webrecorder">
              <Breadcrumb routes={routes} />
              <UserManagement auth={auth} loginFn={this.login} logoutFn={this.logout} />
            </nav>
          </div>
        </header>
        <section className="container wr-content">
          {this.props.children}
        </section>
        <Footer />
      </div>
    );
  }
}


const preloadData = [
  {
    promise: ({ params, store: { dispatch, getState }, location }) => {
      const promises = [];

      if(!isAuthLoaded(getState()))
        promises.push(dispatch(loadAuth()));

      return Promise.all(promises);
    }
  }
];

const mapStateToProps = (state) => {
  const { auth } = state;
  return {
    auth
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    logout: () => dispatch(logout()),
    login: data => dispatch(login(data))
  };
};


export default asyncConnect(
  preloadData,
  mapStateToProps,
  mapDispatchToProps
)(App);
