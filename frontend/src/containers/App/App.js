import React, { Component } from 'react';
import classNames from 'classnames';
import Helmet from 'react-helmet';
import HTML5Backend from 'react-dnd-html5-backend';
import matchPath from 'react-router-dom/matchPath';
import PropTypes from 'prop-types';
import Raven from 'raven-js';
import renderRoutes from 'react-router-config/renderRoutes';
import { Button } from 'react-bootstrap';
import { asyncConnect } from 'redux-connect';
import { DragDropContext } from 'react-dnd';

import { isLoaded as isAuthLoaded,
         load as loadAuth } from 'redux/modules/auth';
import { load as loadUser } from 'redux/modules/user';
import { load as loadTemp } from 'redux/modules/tempUser';

import { UserManagement } from 'containers';

import config from 'config';
import BreadcrumbsUI from 'components/siteComponents/BreadcrumbsUI';
import { Footer } from 'components/siteComponents';

import 'shared/fonts/fonts.scss';
import './style.scss';


// named export for tests
export class App extends Component { // eslint-disable-line

  static propTypes = {
    auth: PropTypes.object,
    loaded: PropTypes.bool,
    route: PropTypes.object,
    location: PropTypes.object,
  }

  static childContextTypes = {
    isAnon: PropTypes.bool
  }

  constructor(props) {
    super(props);

    this.state = {};
  }

  getChildContext() {
    const { auth } = this.props;

    return {
      isAnon: auth.getIn(['user', 'anon'])
    };
  }

  componentWillMount() {
    // set initial route
    this.setState({ match: this.getActiveRoute(this.props.location.pathname) });
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.loaded && !nextProps.loaded) {
      this.setState({ lastMatch: this.state.match });
    }

    if (!this.props.loaded && nextProps.loaded) {
      const match = this.getActiveRoute(nextProps.location.pathname);

      if (this.state.match.path !== match.path) {
        this.setState({ match });
      }
    }
  }

  componentDidUpdate(prevProps) {
    // restore scroll postion
    if (window && this.props.location !== prevProps.location) {
      window.scrollTo(0, 0);
    }
  }

  getActiveRoute = (url) => {
    const { route: { routes } } = this.props;

    const match = routes.find((route) => {
      return matchPath(url, route);
    });

    return match;
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    if (config.ravenConfig) {
      Raven.captureException(error, { extra: info });
    }
  }

  render() {
    const { loaded, location: { pathname } } = this.props;
    const { error, info, lastMatch, match } = this.state;

    const hasFooter = lastMatch && !loaded ? lastMatch.footer : match.footer;
    const classOverride = match.classOverride;
    const lastClassOverride = lastMatch ? lastMatch.classOverride : classOverride;

    const containerClasses = classNames('wr-content', {
      container: !loaded ? !lastClassOverride : !classOverride,
      loading: !loaded
    });

    const navbarClasses = classNames('navbar navbar-default navbar-static-top', {
      'no-shadow': typeof match.noShadow !== 'undefined' ? match.noShadow : false
    });

    if (error || info) {
      console.log('ERROR', error, info);
    }

    return (
      <React.Fragment>
        <Helmet {...config.app.head} />
        <header>
          <div className={navbarClasses}>
            <nav className="container-fluid header-webrecorder">
              <BreadcrumbsUI url={pathname} />
              <UserManagement />
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
                    <p>Oops, the page encountered an error.</p>
                    {
                      config.ravenConfig &&
                        <Button onClick={() => Raven.lastEventId() && Raven.showReportDialog()}>Submit a bug report</Button>
                    }
                  </div>
                </div>
              </div>
            </div> :
            <section className={containerClasses}>
              {renderRoutes(this.props.route.routes)}
            </section>
        }
        {
          hasFooter &&
            <Footer />
        }
      </React.Fragment>
    );
  }
}


const initalData = [
  {
    promise: ({ store: { dispatch, getState } }) => {
      const state = getState();

      if(!isAuthLoaded(state)) {
        return dispatch(loadAuth()).then(
          (auth) => {
            if (auth.anon && auth.coll_count === 0) return undefined;
            return auth.anon ? dispatch(loadTemp(auth.username)) : dispatch(loadUser(auth.username));
          }
        );
      }

      return undefined;
    }
  }
];

const mapStateToProps = ({ reduxAsyncConnect: { loaded }, app }) => {
  return {
    auth: app.get('auth'),
    loaded
  };
};

const DnDApp = DragDropContext(HTML5Backend)(App);

export default asyncConnect(
  initalData,
  mapStateToProps
)(DnDApp);
