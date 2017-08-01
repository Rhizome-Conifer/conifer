import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import classNames from 'classnames';
import { asyncConnect } from 'redux-connect';


import { isLoaded as isAuthLoaded,
         load as loadAuth } from 'redux/modules/auth';

import { UserManagement } from 'containers';

import config from 'config';
import { Breadcrumbs, Footer } from 'components/SiteComponents';

import './style.scss';


// named export for tests
export class App extends Component { // eslint-disable-line

  static contextTypes = {
    router: PropTypes.object
  }

  static propTypes = {
    children: PropTypes.node.isRequired,
    auth: PropTypes.object,
  }

  render() {
    const { routes } = this.context.router;
    const match = routes[routes.length - 1];
    const hasFooter = match.footer;
    const classOverride = match.classOverride;

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
        <section className={classNames({ 'container wr-content': !classOverride })}>
          {this.props.children}
        </section>
        {
          hasFooter &&
            <Footer />
        }
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
