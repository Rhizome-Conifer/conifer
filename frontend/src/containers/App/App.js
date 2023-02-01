import React, { Component } from 'react';
import classNames from 'classnames';
import memoize from 'memoize-one';
import { Helmet } from 'react-helmet';
import HTML5Backend from 'react-dnd-html5-backend';
import PropTypes from 'prop-types';
import Raven from 'raven-js';
import { matchPath } from 'react-router-dom';
import { renderRoutes } from 'react-router-config';
import { Alert, Button, Card } from 'react-bootstrap';
import { asyncConnect } from 'redux-connect';
import { DragDropContext } from 'react-dnd';

import { isLoaded as isAuthLoaded, load as loadAuth } from 'store/modules/auth';
import { AppContext } from 'store/contexts';
import config from 'config';
import { apiFetch, inStorage, setStorage } from 'helpers/utils';

// direct import to prevent circular dependency
import AppHeader from 'containers/AppHeader/AppHeader';

import { ConiferAnnounce, Footer } from 'components/siteComponents';
import { InfoIcon } from 'components/icons';

import 'shared/fonts/fonts.scss';
import './style.scss';


// named export for tests
export class App extends Component {

  static propTypes = {
    auth: PropTypes.object,
    dispatch: PropTypes.func,
    loaded: PropTypes.bool,
    location: PropTypes.object,
    route: PropTypes.object,
    spaceUtilization: PropTypes.object
  };

  constructor(props) {
    super(props);
    const ua = global.navigator ? global.navigator.userAgent : '';

    this.handle = null;
    this.isMobile = Boolean(ua && ua.match(/Mobile|Android|BlackBerry/));
    this.state = {
      coniferAnnounce: true,
      error: null,
      lastPathname: null,
      loginStateAlert: false,
      mobileAlert: true,
      outOfSpaceAlert: true,
      stalled: false
    };
  }

  static getDerivedStateFromProps(props, state) {
    if (!props.loaded) {
      const newState = state;
      newState.lastPathname = props.location.pathname;
      return newState;
    }

    return null;
  }

  componentDidMount() {
    if (this.isMobile) {
      if (inStorage('mobileNotice', window.sessionStorage)) {
        this.setState({ mobileAlert: false });
      }
    }

    if (inStorage('coniferAnnounceDismiss')) {
      this.setState({ coniferAnnounce: false });
    }

    if (typeof document.hidden !== 'undefined') {
      this.hidden = 'hidden';
      this.visibilityChange = 'visibilitychange';
    } else if (typeof document.msHidden !== 'undefined') {
      this.hidden = 'msHidden';
      this.visibilityChange = 'msvisibilitychange';
    } else if (typeof document.webkitHidden !== 'undefined') {
      this.hidden = 'webkitHidden';
      this.visibilityChange = 'webkitvisibilitychange';
    }

    document.addEventListener(this.visibilityChange, this.heartbeat);

    if (__DESKTOP__) {
      //this.setState({ match: this.getActiveRoute("/") });
      this.props.history.push("/");
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.loaded && !this.props.loaded) {
      this.handle = setTimeout(() => this.setState({ stalled: true }), 7500);
    }

    // check if login state changed and logout alert is active
    if (prevProps.auth.get('loggingIn') && !this.props.auth.get('loggingIn')) {
      this.setState({ loginStateAlert: false });
    }

    // restore scroll postion
    if (this.props.location !== prevProps.location) {
      clearTimeout(this.handle);

      if (window) {
        window.scrollTo(0, 0);
      }

      // clear error state on navigation
      if (this.state.error) {
        this.setState({ error: null, info: null });
      }
    }
  }

  componentWillUnmount() {
    clearTimeout(this.handle);
    document.removeEventListener(this.visibilityChange, this.heartbeat);
  }

  coniferAnnounceDismiss = () => {
    setStorage('coniferAnnounceDismiss', '1');
    this.setState({ coniferAnnounce: false });
  }

  dismissStalledAlert = () => this.setState({ stalled: false })

  dismissSpaceAlert = () => this.setState({ outOfSpaceAlert: false })

  dismissLoginAlert = () => this.setState({ loginStateAlert: false })

  dismissMobileAlert = () => {
    this.setState({ mobileAlert: false });
    setStorage('mobileNotice', false, window.sessionStorage);
  }

  getActiveRoute = memoize((url) => {
    const { route: { routes } } = this.props;

    const match = routes.find((route) => {
      return matchPath(this.props.location.pathname, route);
    });

    return match;
  })

  heartbeat = () => {
    const { auth } = this.props;

    if (!document[this.hidden]) {
      apiFetch('/auth/curr_user')
        .then(res => res.json())
        .then((data) => {
          const user = auth.get('user');
          if (user.get('anon')) {
            if (user.get('num_collections') > 0 && user.get('username') !== data.user.username) {
              this.setState({ loginStateAlert: true });
              this.props.dispatch(loadAuth());
            }
          } else if (user.get('username') !== data.user.username) {
            this.setState({ loginStateAlert: true });
          }
        });
    }
  }

  refresh = () => {
    window.location.reload();
  }

  componentDidCatch(error, info) {
    this.setState({ error, info });
    if (config.ravenConfig) {
      Raven.captureException(error, { extra: info });
    }
  }

  render() {
    const { auth, loaded, location: { pathname }, spaceUtilization } = this.props;
    const { error, info, lastPathname } = this.state;

    const match = this.getActiveRoute(pathname);
    const contextValues = {
      isAnon: auth.getIn(['user', 'anon']),
      isEmbed: match.embed || false,
      isMobile: this.isMobile,
    };

    const lastMatch = this.getActiveRoute(lastPathname);

    const hasFooter = lastMatch && !loaded ? lastMatch.footer : match.footer;
    const { classOverride } = match;
    const isEmbed = match.embed;
    const lastClassOverride = lastMatch ? lastMatch.classOverride : classOverride;
    const isOutOfSpace = spaceUtilization ? spaceUtilization.get('available') <= 0 : false;

    const containerClasses = classNames('wr-content', [!loaded ? lastClassOverride : classOverride], {
      container: !loaded ? typeof lastClassOverride === 'undefined' : typeof classOverride === 'undefined',
      loading: !loaded,
      'is-mobile': this.isMobile
    });

    if (error || info) {
      console.log('ERROR', error, info);
    }

    return (
      <React.Fragment>
        <Helmet {...config.app.head} />
        {
          match.name === 'landing' && this.state.coniferAnnounce &&
            <ConiferAnnounce dismiss={this.coniferAnnounceDismiss} />
        }
        {
          !isEmbed &&
            <AppHeader routes={this.props.route.routes} />
        }
        {
          isOutOfSpace && this.state.outOfSpaceAlert &&
            <Alert variant="warning" className="oos-alert" dismissible onClose={this.dismissSpaceAlert}>
              <p><b>Your account is out of space.</b> This means you can't capture anything right now.</p>
              To be able to capture again, you can:
              <ul>
                {
                  config.supporterPortal &&
                    <li><a href={config.supporterPortal} target="_blank">Become a Supporter</a> to get more storage space.</li>
                }
                <li>Download some collections or sessions and then delete them to make more space.</li>
              </ul>
            </Alert>
        }
        {
          this.state.stalled &&
            <Card className="stalled-alert">
              <Card.Header>Oops, this request seems to be taking a long time..</Card.Header>
              <Card.Body>
                <p>
                  Please refresh the page and try again. If the problem persists, contact <a href={`mailto:${config.supportEmail}`}>support</a>.
                </p>
                <Button variant="outline-secondary" onClick={this.dismissStalledAlert}>dismiss</Button>
              </Card.Body>
            </Card>
        }
        {
          this.state.loginStateAlert &&
            <Alert variant="warning" className="not-logged-in" dismissible onClose={this.dismissLoginAlert}>
              Please <button className="button-link" onClick={this.refresh} type="button">reload the page</button>. Session has ended.
            </Alert>
        }
        <AppContext.Provider value={contextValues}>
          {
            error ?
              <div className="wr-content">
                <div className="container col-md-4 col-md-offset-4 top-buffer-lg">
                  <Card variant="danger" className="error-panel">
                    <Card.Header><InfoIcon /> Oops!</Card.Header>
                    <Card.Body>
                      <Card.Title>Oops, the page encountered an error.</Card.Title>
                      {
                        config.ravenConfig &&
                          <Button variant="primary" onClick={() => Raven.lastEventId() && Raven.showReportDialog()}>Submit a bug report</Button>
                      }
                    </Card.Body>
                  </Card>
                </div>
              </div> :
              <section role="main" className={containerClasses}>
                {renderRoutes(this.props.route.routes)}
              </section>
          }
          {
            hasFooter && !__DESKTOP__ &&
              <Footer />
          }
        </AppContext.Provider>
      </React.Fragment>
    );
  }
}


const initalData = [
  {
    promise: ({ store: { dispatch, getState } }) => {
      const state = getState();

      if (!isAuthLoaded(state)) {
        return dispatch(loadAuth());
      }

      return undefined;
    }
  }
];

const mapStateToProps = ({ reduxAsyncConnect: { loaded }, app }) => {
  return {
    auth: app.get('auth'),
    loaded,
    spaceUtilization: app.getIn(['auth', 'user', 'space_utilization'])
  };
};

const DnDApp = DragDropContext(HTML5Backend)(App);

export default asyncConnect(
  initalData,
  mapStateToProps
)(DnDApp);
