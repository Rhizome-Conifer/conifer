import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import config from 'config';
import { getRemoteBrowser } from 'helpers/utils';

import { isLoaded, load as loadColl } from 'redux/modules/collection';
import { getArchives, updateUrl, updateTimestamp } from 'redux/modules/controls';
import { load as loadBrowsers, setBrowser } from 'redux/modules/remoteBrowsers';

import { RemoteBrowser } from 'containers';
import { IFrame, ReplayUI } from 'components/controls';


class Record extends Component {
  static contextTypes = {
    product: PropTypes.string
  };

  static propTypes = {
    activeBrowser: PropTypes.string,
    auth: PropTypes.object,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    params: PropTypes.object,
    reqId: PropTypes.string,
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
    const { auth, params } = this.props;

    return {
      currMode: 'record',
      canAdmin: auth.getIn(['user', 'username']) === params.user
    };
  }

  render() {
    const { activeBrowser, dispatch, params, reqId, timestamp, url } = this.props;
    const { user, coll, rec } = params;

    const appPrefix = `${config.appHost}/${user}/${coll}/${rec}/record/`;
    const contentPrefix = `${config.contentHost}/${user}/${coll}/${rec}/record/`;

    return (
      <div>
        <ReplayUI
          params={params}
          url={url} />

        {
          activeBrowser ?
            <RemoteBrowser
              dispatch={dispatch}
              mode={this.mode}
              params={params}
              rb={activeBrowser}
              rec={rec}
              recId={reqId}
              url={url} /> :
            <IFrame
              appPrefix={appPrefix}
              contentPrefix={contentPrefix}
              dispatch={dispatch}
              params={params}
              timestamp={timestamp}
              url={url} />
        }
      </div>
    );
  }
}

const initialData = [
  {
    promise: ({ store: { dispatch } }) => {
      return dispatch(loadBrowsers());
    }
  },
  {
    // set url and remote browser
    promise: ({ params: { br, splat }, store: { dispatch } }) => {
      const rb = getRemoteBrowser(br);

      const promises = [
        dispatch(updateUrl(splat)),
        dispatch(setBrowser(rb))
      ];

      return Promise.all(promises);
    }
  },
  {
    promise: ({ params, store: { dispatch, getState } }) => {
      const state = getState();
      const collection = state.get('collection');
      const { user, coll } = params;

      if(!isLoaded(state) || (collection.get('id') === coll &&
         Date.now() - collection.get('accessed') > 15 * 60 * 1000)) {
        return dispatch(loadColl(user, coll));
      }

      return undefined;
    }
  },
  {
    promise: ({ store: { dispatch, getState } }) => {
      const state = getState();

      // TODO: determine if we need to test for stale archives
      if (!state.getIn(['controls', 'archives']).size) {
        return dispatch(getArchives());
      }

      return undefined;
    }
  }
];

const mapStateToProps = (state) => {
  return {
    activeBrowser: state.getIn(['remoteBrowsers', 'activeBrowser']),
    collection: state.get('collection'),
    auth: state.get('auth'),
    reqId: state.getIn(['remoteBrowsers', 'reqId']),
    timestamp: state.getIn(['controls', 'timestamp']),
    url: state.getIn(['controls', 'url'])
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps
)(Record);
