import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { asyncConnect } from 'redux-connect';

import config from 'config';

import { isLoaded, load as loadColl } from 'store/modules/collection';
import { getArchives, updateUrl } from 'store/modules/controls';
import { loadRecording } from 'store/modules/recordings';
import { load as loadBrowsers, isLoaded as isRBLoaded, setBrowser } from 'store/modules/remoteBrowsers';

import { RemoteBrowser } from 'containers';
import { IFrame, ReplayUI } from 'components/controls';


class Record extends Component {
  static contextTypes = {
    product: PropTypes.string
  };

  static propTypes = {
    activeBrowser: PropTypes.string,
    autoscroll: PropTypes.bool,
    auth: PropTypes.object,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    match: PropTypes.object,
    timestamp: PropTypes.string,
    url: PropTypes.string
  };

  // TODO move to HOC
  static childContextTypes = {
    currMode: PropTypes.string,
    canAdmin: PropTypes.bool
  };

  constructor(props) {
    super(props);

    this.mode = 'record';
  }

  getChildContext() {
    const { auth, match: { params: { user } } } = this.props;

    return {
      currMode: 'record',
      canAdmin: auth.getIn(['user', 'username']) === user
    };
  }

  // shouldComponentUpdate(nextProps) {
  //   // don't rerender for loading changes
  //   if (!nextProps.loaded) {
  //     return false;
  //   }

  //   return true;
  // }

  render() {
    const { activeBrowser, dispatch, match: { params }, timestamp, url } = this.props;
    const { user, coll, rec } = params;

    const appPrefix = `${config.appHost}/${user}/${coll}/${rec}/record/`;
    const contentPrefix = `${config.contentHost}/${user}/${coll}/${rec}/record/`;

    return (
      <React.Fragment>
        <Helmet>
          <title>Recording</title>
        </Helmet>
        <ReplayUI
          activeBrowser={activeBrowser}
          params={params}
          url={url} />

        <div className="iframe-container">
          {
            activeBrowser ?
              <RemoteBrowser
                params={params}
                rb={activeBrowser}
                rec={rec}
                url={url} /> :
              <IFrame
                appPrefix={appPrefix}
                auth={this.props.auth}
                autoscroll={this.props.autoscroll}
                contentPrefix={contentPrefix}
                dispatch={dispatch}
                params={params}
                timestamp={timestamp}
                url={url} />
          }
        </div>
      </React.Fragment>
    );
  }
}

const initialData = [
  {
    promise: ({ store: { dispatch, getState } }) => {
      if (!isRBLoaded(getState()) && !__PLAYER__) {
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
    // load recording info
    promise: ({ match: { params: { user, coll, rec } }, store: { dispatch } }) => {
      return dispatch(loadRecording(user, coll, rec));
    }
  },
  {
    promise: ({ match: { params }, store: { dispatch, getState } }) => {
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

const mapStateToProps = ({ app }) => {
  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    autoscroll: app.getIn(['controls', 'autoscroll']),
    auth: app.get('auth'),
    collection: app.get('collection'),
    timestamp: app.getIn(['controls', 'timestamp']),
    url: app.getIn(['controls', 'url'])
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps
)(Record);
