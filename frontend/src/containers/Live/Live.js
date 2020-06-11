import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Helmet } from 'react-helmet';
import { asyncConnect } from 'redux-connect';

import config from 'config';

import { isLoaded, load as loadColl } from 'store/modules/collection';
import { updateUrl } from 'store/modules/controls';

import { RemoteBrowser } from 'containers';
import { IFrame, ReplayUI } from 'components/controls';
import { load as loadBrowsers, isLoaded as isRBLoaded, setBrowser } from 'store/modules/remoteBrowsers';

const { ipcRenderer } = window.require('electron');


let Webview;
if (__DESKTOP__) {
  Webview = require('components/desktop/Webview');
}


class Live extends Component {
  static propTypes = {
    activeBrowser: PropTypes.string,
    appSettings: PropTypes.object,
    auth: PropTypes.object,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    match: PropTypes.object,
    timestamp: PropTypes.string,
    url: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.mode = 'live';
  }

  // shouldComponentUpdate(nextProps) {
  //   // don't rerender for loading changes
  //   if (!nextProps.loaded) {
  //     return false;
  //   }

  //   return true;
  // }

  render() {
    const { activeBrowser, appSettings, auth, dispatch, match: { params }, timestamp, url } = this.props;
    const { user, coll, rec } = params;

    const canAdmin = auth.getIn(['user', 'username']) === params.user;
    const appPrefix = `${config.appHost}/${user}/live/`;
    const contentPrefix = `${config.contentHost}/${user}/live/`;

    return (
      <React.Fragment>
        <Helmet>
          <title>Previewing</title>
        </Helmet>
        <ReplayUI
          activeBrowser={activeBrowser}
          canGoBackward={__DESKTOP__ ? appSettings.get('canGoBackward') : false}
          canGoForward={__DESKTOP__ ? appSettings.get('canGoForward') : false}
          canAdmin={canAdmin}
          currMode={this.mode}
          params={params}
          url={url} />

        <div className="iframe-container">
          {
            __DESKTOP__ &&
              <Webview
                canGoBackward={appSettings.get('canGoBackward')}
                canGoForward={appSettings.get('canGoForward')}
                currMode={this.mode}
                key="webview"
                host={appSettings.get('host')}
                params={params}
                dispatch={dispatch}
                timestamp={timestamp}
                partition={`persist:${params.user}`}
                url={url}
                {...{ coll, user, rec }} />
          }

          {
            !__DESKTOP__ && (
              activeBrowser ?
                <RemoteBrowser
                  currMode={this.mode}
                  params={params}
                  rb={activeBrowser}
                  rec={rec}
                  url={url} /> :
                <IFrame
                  appPrefix={appPrefix}
                  auth={this.props.auth}
                  contentPrefix={contentPrefix}
                  currMode={this.mode}
                  dispatch={dispatch}
                  params={params}
                  timestamp={timestamp}
                  url={url} />
            )
          }
        </div>
      </React.Fragment>
    );
  }
}

const initialData = [
  {
    promise: () => {
      ipcRenderer.send('toggle-proxy', false);

      return new Promise((resolve, reject) => {
        ipcRenderer.on('toggle-proxy-done', () => { resolve(true); });
      });

    }
  },
  {
    promise: ({ store: { dispatch, getState } }) => {
      if (!isRBLoaded(getState()) && !__DESKTOP__) {
        return dispatch(loadBrowsers());
      }

      return undefined;
    }
  },
  {
    // set url and remote browser
    promise: ({ location: { hash, search }, match: { params: { br, splat } }, store: { dispatch } }) => {
      const compositeUrl = `${splat}${search || ''}${hash || ''}`;
      const promises = [
        dispatch(updateUrl(compositeUrl)),
        dispatch(setBrowser(br || null))
      ];

      return Promise.all(promises);
    }
  },
  {
    promise: ({ match: { params }, store: { dispatch, getState } }) => {
      const state = getState();
      const collection = state.app.get('collection');
      const { user, coll } = params;

      if (!isLoaded(state) || collection.get('id') !== coll) {
        let host = '';

        if (__DESKTOP__) {
          host = state.app.getIn(['appSettings', 'host']);
        }

        return dispatch(loadColl(user, coll, host));
      }

      return undefined;
    }
  }
];

const mapStateToProps = ({ app }) => {
  let appSettings = null;

  if (__DESKTOP__) {
    appSettings = app.get('appSettings');
  }

  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    appSettings,
    auth: app.get('auth'),
    collection: app.get('collection'),
    timestamp: app.getIn(['controls', 'timestamp']),
    url: app.getIn(['controls', 'url'])
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps
)(Live);
