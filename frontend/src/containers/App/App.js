import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import classNames from 'classnames';
import { asyncConnect } from 'redux-connect';
import { BreadcrumbsProvider, BreadcrumbsItem } from 'react-breadcrumbs-dynamic';

import { isLoaded as isAuthLoaded,
         load as loadAuth } from 'redux/modules/auth';
import { load as loadUser } from 'redux/modules/user';

import { UserManagement } from 'containers';

import config from 'config';
import { BreadcrumbsUI, Footer } from 'components/siteComponents';

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

  constructor(props) {
    super(props);

    this.state = { };
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

  componentDidCatch(error, info) {
    this.setState({ error, info });
  }

  render() {
    const { routes } = this.context.router;
    const { loaded } = this.props;
    const { error, info } = this.state;

    const match = routes[routes.length - 1];
    const hasFooter = match.footer;
    const classOverride = match.classOverride;
    const classes = classNames({
      'container wr-content': !classOverride,
      loading: !loaded
    });
    console.log('rendering app');

    if (error || info) {
      console.log('ERROR', error, info);
    }

    return (
      <BreadcrumbsProvider>
        <div className="wr-app">
          <Helmet {...config.app.head} />
          <header>
            <div className="navbar navbar-default navbar-static-top">
              <nav className="container-fluid header-webrecorder">
                {
                  !error ?
                    <BreadcrumbsUI /> :
                    <a href="/">Webrecorder</a>
                }
                <UserManagement />
                <BreadcrumbsItem to="/">Webrecorder</BreadcrumbsItem>
              </nav>
            </div>
          </header>
          {
            error ?
              <div>
                <div className="container col-md-4 col-md-offset-4 top-buffer-lg">
                  <div className="panel panel-danger">
                    <div className="panel-heading">
                      <span className="glyphicon glyphicon-exclamation-sign" aria-hidden="true" />
                      <strong className="left-buffer">Oop!</strong>
                    </div>
                    <div className="panel-body">
                      <p>It borked!</p>
                    </div>
                  </div>
                </div>
              </div> :
              <section className={classes}>
                {this.props.children}
              </section>
          }
          {
            hasFooter &&
              <Footer />
          }
        </div>
      </BreadcrumbsProvider>
    );
  }
}


const preloadData = [
  {
    promise: ({ store: { dispatch, getState } }) => {
      if(!isAuthLoaded(getState())) {
        return dispatch(loadAuth()).then(
          (auth) => { return auth.username ? dispatch(loadUser(auth.username)) : undefined; }
        );
      }

      return undefined;
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
