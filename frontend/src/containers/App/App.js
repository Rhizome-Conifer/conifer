import React, { Component } from 'react';
import classNames from 'classnames';
import Helmet from 'react-helmet';
import HTML5Backend from 'react-dnd-html5-backend';
import matchPath from 'react-router-dom/matchPath';
import PropTypes from 'prop-types';
import Raven from 'raven-js';
import renderRoutes from 'react-router-config/renderRoutes';
import { Alert, Button, Navbar, Panel } from 'react-bootstrap';
import { asyncConnect } from 'redux-connect';
import { DragDropContext } from 'react-dnd';

import { isLoaded as isAuthLoaded, load as loadAuth } from 'redux/modules/auth';

import { UserManagement } from 'containers';

import config from 'config';
import { apiFetch, inStorage, setStorage } from 'helpers/utils';

import BreadcrumbsUI from 'components/siteComponents/BreadcrumbsUI';
import { Footer } from 'components/siteComponents';
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
  }

  static childContextTypes = {
    isAnon: PropTypes.bool,
    isEmbed: PropTypes.bool,
    isMobile: PropTypes.bool
  }

  constructor(props) {
    super(props);
    const ua = global.navigator ? global.navigator.userAgent : '';

    this.handle = null;
    this.isMobile = Boolean(ua.match(/Mobile|Android|BlackBerry/));
    this.state = {
      error: null,
      loginStateAlert: false,
      mobileAlert: true,
      outOfSpaceAlert: true,
      stalled: false,
    };
  }

  getChildContext() {
    const { auth } = this.props;

    return {
      isAnon: auth.getIn(['user', 'anon']),
      isEmbed: this.state.match.embed || false,
      isMobile: this.isMobile,
    };
  }

  componentWillMount() {
    // set initial route
    this.setState({ match: this.getActiveRoute(this.props.location.pathname) });
  }

  componentDidMount() {
    if (this.isMobile) {
      if (inStorage('mobileNotice', window.sessionStorage)) {
        this.setState({ mobileAlert: false });
      }
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
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.loaded && !nextProps.loaded) {
      this.handle = setTimeout(() => this.setState({ stalled: true }), 7500);
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

  dismissSpaceAlert = () => this.setState({ outOfSpaceAlert: false })

  dismissLoginAlert = () => this.setState({ loginStateAlert: false })

  dismissMobileAlert = () => {
    this.setState({ mobileAlert: false });
    setStorage('mobileNotice', false, window.sessionStorage);
  }

  getActiveRoute = (url) => {
    const { route: { routes } } = this.props;

    const match = routes.find((route) => {
      return matchPath(url, route);
    });

    return match;
  }

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
    const { loaded, location: { pathname, search }, spaceUtilization } = this.props;
    const { error, info, lastMatch, match } = this.state;

    const hasFooter = lastMatch && !loaded ? lastMatch.footer : match.footer;
    const classOverride = match.classOverride;
    const isEmbed = match.embed;
    const lastClassOverride = lastMatch ? lastMatch.classOverride : classOverride;
    const isOutOfSpace = spaceUtilization ? spaceUtilization.get('available') <= 0 : false;

    const containerClasses = classNames('wr-content', [!loaded ? lastClassOverride : classOverride], {
      container: !loaded ? typeof lastClassOverride === 'undefined' : typeof classOverride === 'undefined',
      loading: !loaded,
      'is-mobile': this.isMobile
    });

    const navbarClasses = classNames('header-webrecorder', {
      'no-shadow': typeof match.noShadow !== 'undefined' ? match.noShadow : false
    });

    if (error || info) {
      console.log('ERROR', error, info);
    }

    return (
      <React.Fragment>
        <Helmet {...config.app.head} />
        {
          !isEmbed &&
            <header>
              <Navbar staticTop fluid collapseOnSelect className={navbarClasses} role="navigation">
                <Navbar.Header>
                  <BreadcrumbsUI is404={this.props.is404} url={pathname} />
                  <Navbar.Toggle />
                </Navbar.Header>
                <Navbar.Collapse>
                  <UserManagement />
                </Navbar.Collapse>
              </Navbar>
            </header>
        }
        {
          isOutOfSpace && this.state.outOfSpaceAlert &&
            <Alert bsStyle="warning" className="oos-alert" onDismiss={this.dismissSpaceAlert}>
              <p><b>Your account is out of space.</b> This means you can't record anything right now.</p>
              To be able to record again, you can:
              <ul>
                <li>Download some collections or recordings and then delete them to make space.</li>
                <li><a href={`mailto:${config.supportEmail}`}>Contact Us</a> to request more space.</li>
              </ul>
            </Alert>
        }
        {
          this.state.stalled &&
            <Panel className="stalled-alert" bsStyle="warning">
              <Panel.Heading>Oops, this request seems to be taking a long time..</Panel.Heading>
              <Panel.Body>
                Please refresh the page and try again. If the problem persists, contact <a href={`mailto:${config.supportEmail}`}>support</a>.
              </Panel.Body>
            </Panel>
        }
        {
          this.isMobile && this.state.mobileAlert &&
            <Alert className="mobile-alert" onDismiss={this.dismissMobileAlert}>
              Please note: Webrecorder doesn't currently support mobile devices.
            </Alert>
        }
        {
          this.state.loginStateAlert &&
            <Alert className="not-logged-in" onDismiss={this.dismissLoginAlert}>
              Please <button className="button-link" onClick={this.refresh}>reload the page</button>. Session has ended.
            </Alert>
        }
        {
          error ?
            <div>
              <div className="container col-md-4 col-md-offset-4 top-buffer-lg">
                <Panel bsStyle="danger" className="error-panel">
                  <Panel.Heading><InfoIcon /> Oops!</Panel.Heading>
                  <Panel.Body>
                    <p>Oops, the page encountered an error.</p>
                    {
                      config.ravenConfig &&
                        <Button onClick={() => Raven.lastEventId() && Raven.showReportDialog()}>Submit a bug report</Button>
                    }
                  </Panel.Body>
                </Panel>
              </div>
            </div> :
            <section role="main" className={containerClasses}>
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
    is404: app.getIn(['controls', 'is404']),
    loaded,
    spaceUtilization: app.getIn(['auth', 'user', 'space_utilization'])
  };
};

const DnDApp = DragDropContext(HTML5Backend)(App);

export default asyncConnect(
  initalData,
  mapStateToProps
)(DnDApp);
