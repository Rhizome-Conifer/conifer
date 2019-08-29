import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Helmet from 'react-helmet';
import { asyncConnect } from 'redux-connect';

import config from 'config';

import { isLoaded, load as loadColl } from 'store/modules/collection';
import { getArchives, updateUrlAndTimestamp } from 'store/modules/controls';
import { resetStats } from 'store/modules/infoStats';
import { load as loadBrowsers, isLoaded as isRBLoaded, setBrowser } from 'store/modules/remoteBrowsers';

import { Autopilot, RemoteBrowser } from 'containers';
import { IFrame, ReplayUI } from 'components/controls';

let Webview;
let ipcRenderer;
if (__DESKTOP__) {
  // eslint-disable-next-line
  ipcRenderer = window.require('electron').ipcRenderer;
  Webview = require('components/desktop/Webview');
}


class Patch extends Component {
  static contextTypes = {
    product: PropTypes.string
  }

  static propTypes = {
    activeBrowser: PropTypes.string,
    appSettings: PropTypes.object,
    auth: PropTypes.object,
    behavior: PropTypes.bool,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    autopilotRunning: PropTypes.bool,
    match: PropTypes.object,
    timestamp: PropTypes.string,
    url: PropTypes.string
  };

  // TODO move to HOC
  static childContextTypes = {
    currMode: PropTypes.string,
    canAdmin: PropTypes.bool,
    coll: PropTypes.string,
    rec: PropTypes.string,
    user: PropTypes.string,
  };

  constructor(props) {
    super(props);

    this.mode = 'patch';
  }

  getChildContext() {
    const { auth, match: { params: { user, coll, rec } } } = this.props;

    return {
      currMode: 'patch',
      canAdmin: auth.getIn(['user', 'username']) === user,
      user,
      coll,
      rec
    };
  }

  componentWillUnmount() {
    // clear info stats
    this.props.dispatch(resetStats());
  }

  render() {
    const { activeBrowser, appSettings, autopilotRunning, dispatch, match: { params }, timestamp, url } = this.props;
    const { user, coll, rec } = params;

    const appPrefix = `${config.appHost}/${user}/${coll}/${rec}/patch/`;
    const contentPrefix = `${config.contentHost}/${user}/${coll}/${rec}/patch/`;

    return (
      <React.Fragment>
        <Helmet>
          <title>Patching</title>
        </Helmet>
        <ReplayUI
          activeBrowser={activeBrowser}
          autopilotRunning={autopilotRunning}
          canGoBackward={__DESKTOP__ ? appSettings.get('canGoBackward') : false}
          canGoForward={__DESKTOP__ ? appSettings.get('canGoForward') : false}
          params={params}
          timestamp={timestamp}
          url={url} />
        <div className={classNames('iframe-container', { locked: autopilotRunning })}>
          {
            __DESKTOP__ &&
              <Webview
                behavior={this.props.behavior}
                canGoBackward={appSettings.get('canGoBackward')}
                canGoForward={appSettings.get('canGoForward')}
                dispatch={dispatch}
                host={appSettings.get('host')}
                key="webview"
                params={params}
                partition={`persist:${params.user}`}
                timestamp={timestamp}
                url={url} />
          }

          {
            !__DESKTOP__ && (
              activeBrowser ?
                <RemoteBrowser
                  params={params}
                  rb={activeBrowser}
                  rec={rec}
                  url={url} /> :
                <IFrame
                  appPrefix={appPrefix}
                  auth={this.props.auth}
                  behavior={this.props.behavior}
                  contentPrefix={contentPrefix}
                  dispatch={dispatch}
                  params={params}
                  timestamp={timestamp}
                  url={url} />
            )
          }

          <Autopilot />
        </div>

      </React.Fragment>
    );
  }
}

const initialData = [
  {
    promise: ({ store: { dispatch, getState } }) => {
      if (!isRBLoaded(getState()) && !__DESKTOP__) {
        return dispatch(loadBrowsers());
      }

      return undefined;
    }
  },
  {
    // set url and ts in store
    promise: ({ location: { hash, search }, match: { params: { br, ts, splat } }, store: { dispatch } }) => {
      const compositeUrl = `${splat}${search || ''}${hash || ''}`;
      const promises = [
        dispatch(updateUrlAndTimestamp(compositeUrl, ts)),
        dispatch(setBrowser(br || null))
      ];

      return Promise.all(promises);
    }
  },
  {
    promise: ({ match: { params }, store: { dispatch, getState } }) => {
      // load collection
      const state = getState();
      const collection = state.app.get('collection');
      const { user, coll } = params;

      if (!isLoaded(state) || collection.get('id') !== coll) {
        return dispatch(loadColl(user, coll));
      }

      return undefined;
    }
  },
  {
    promise: ({ store: { dispatch, getState } }) => {
      const { app } = getState();

      // TODO: determine if we need to test for stale archives
      if (!app.getIn(['controls', 'archives']).size) {
        return dispatch(getArchives());
      }

      return undefined;
    }
  }
];

if (__DESKTOP__) {
  initialData.push(
    {
      promise: () => {
        ipcRenderer.send('toggle-proxy', true);
        return new Promise((resolve, reject) => {
          ipcRenderer.on('toggle-proxy-done', () => { resolve(true); });
        });
      }
    },
  );
}

const mapStateToProps = ({ app }) => {
  let appSettings = null;

  if (__DESKTOP__) {
    appSettings = app.get('appSettings');
  }

  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    appSettings,
    auth: app.get('auth'),
    behavior: app.getIn(['automation', 'behavior']),
    collection: app.get('collection'),
    autopilotRunning: app.getIn(['automation', 'autopilotStatus']) === 'running',
    timestamp: app.getIn(['controls', 'timestamp']),
    url: app.getIn(['controls', 'url'])
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps
)(Patch);
