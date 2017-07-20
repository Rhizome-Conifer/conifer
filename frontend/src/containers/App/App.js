import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { asyncConnect } from 'redux-connect';


import { isLoaded as isAuthLoaded,
         load as loadAuth } from 'redux/modules/auth';

import { UserManagement } from 'containers';

import config from 'config';
import Breadcrumbs from 'components/Breadcrumbs';
import Footer from 'components/Footer';

import './style.scss';


// named export for tests
export class App extends Component { // eslint-disable-line

  static propTypes = {
    children: PropTypes.node.isRequired,
    auth: PropTypes.object,
  }

  render() {
    return (
      <div className="wr-app">
        <Helmet {...config.app.head} />
        <header>
          <div className="navbar navbar-default navbar-static-top">
            <nav className="container-fluid header-webrecorder">
              <Breadcrumbs />
              <UserManagement />
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


export default asyncConnect(
  preloadData
)(App);
