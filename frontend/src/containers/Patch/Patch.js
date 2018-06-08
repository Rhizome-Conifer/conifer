import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import config from 'config';

import { isLoaded, load as loadColl } from 'store/modules/collection';
import { getArchives, updateUrlAndTimestamp } from 'store/modules/controls';
import { resetStats } from 'store/modules/infoStats';
import { load as loadBrowsers, isLoaded as isRBLoaded, setBrowser } from 'store/modules/remoteBrowsers';

import { RemoteBrowser } from 'containers';
import { IFrame, ReplayUI } from 'components/controls';


class Patch extends Component {
  static contextTypes = {
    product: PropTypes.string
  }

  static propTypes = {
    activeBrowser: PropTypes.string,
    auth: PropTypes.object,
    autoscroll: PropTypes.bool,
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

    this.mode = 'patch';
  }

  getChildContext() {
    const { auth, match: { params: { user } } } = this.props;

    return {
      currMode: 'patch',
      canAdmin: auth.getIn(['user', 'username']) === user
    };
  }

  componentWillUnmount() {
    // clear info stats
    this.props.dispatch(resetStats());
  }

  render() {
    const { activeBrowser, dispatch, match: { params }, timestamp, url } = this.props;
    const { user, coll, rec } = params;

    const appPrefix = `${config.appHost}/${user}/${coll}/${rec}/patch/`;
    const contentPrefix = `${config.contentHost}/${user}/${coll}/${rec}/patch/`;

    return (
      <React.Fragment>
        <ReplayUI
          params={params}
          timestamp={timestamp}
          url={url} />
        <div className="iframe-container">
          {
            activeBrowser ?
              <RemoteBrowser
                params={params}
                rb={activeBrowser}
                rec={rec}
                timestamp={timestamp}
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

const mapStateToProps = ({ app }) => {
  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    auth: app.get('auth'),
    autoscroll: app.getIn(['controls', 'autoscroll']),
    collection: app.get('collection'),
    timestamp: app.getIn(['controls', 'timestamp']),
    url: app.getIn(['controls', 'url'])
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps
)(Patch);
