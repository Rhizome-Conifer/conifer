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
    loaded: PropTypes.bool
  }

  static childContextTypes = {
    product: PropTypes.string,
    isAnon: PropTypes.bool,
    metadata: PropTypes.shape({
      product: PropTypes.string,
      type: PropTypes.string,
      host: PropTypes.string,
    })
  }

  getChildContext() {
    const { auth } = this.props;

    return {
      isAnon: auth.getIn(['user', 'anon']),
      metadata: {
        product: 'Webrecorder',
        type: 'hosted',
        host: 'http://localhost:3000/'
      }
    };
  }

  render() {
    const { routes } = this.context.router;
    const { loaded } = this.props;

    const match = routes[routes.length - 1];
    const hasFooter = match.footer;
    const classOverride = match.classOverride;
    const classes = classNames({
      'container wr-content': !classOverride,
      loading: !loaded
    });
    console.log('rendering app');

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
        <section className={classes}>
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
    promise: ({ store: { dispatch, getState } }) => {
      const promises = [];

      if(!isAuthLoaded(getState()))
        promises.push(dispatch(loadAuth()));

      return Promise.all(promises);
    }
  }
];

const mapStateToProps = (state) => {
  const auth = state.get('auth');
  const loaded = state.getIn(['reduxAsyncConnect', 'loaded']);
  return {
    auth,
    loaded
  };
};

export default asyncConnect(
  preloadData,
  mapStateToProps
)(App);
