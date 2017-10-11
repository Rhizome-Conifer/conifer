import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import config from 'config';

import { isLoaded, load as loadColl } from 'redux/modules/collection';
import { getArchives, setExtractable, updateUrl, updateTimestamp } from 'redux/modules/controls';
import { resetStats } from 'redux/modules/infoStats';
import { selectCollection } from 'redux/modules/user';
import { getActiveCollection } from 'redux/selectors';

import { RemoteBrowser } from 'containers';
import { IFrame, ReplayUI } from 'components/controls';


class Extract extends Component {
  static contextTypes = {
    product: PropTypes.string
  };

  static propTypes = {
    activeBrowser: PropTypes.string,
    auth: PropTypes.object,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    extractable: PropTypes.object,
    params: PropTypes.object,
    reqId: PropTypes.string,
    timestamp: PropTypes.string,
    url: PropTypes.string
  };

  // TODO move to HOC
  static childContextTypes = {
    currMode: PropTypes.string,
    canAdmin: PropTypes.bool,
    product: PropTypes.string
  };

  constructor(props) {
    super(props);

    this.mode = props.params.extractMode;
  }

  getChildContext() {
    const { auth, params: { extractMode, user } } = this.props;

    return {
      currMode: extractMode,
      canAdmin: auth.getIn(['user', 'username']) === user
    };
  }

  componentWillUnmount() {
    // clear info stats
    this.props.dispatch(resetStats());
  }

  render() {
    const { activeBrowser, activeCollection, dispatch, extractable, params,
            reqId, timestamp, url } = this.props;
    const { user, coll, rec } = params;

    const archId = extractable.get('id');
    const extractFrag = `${extractable.get('allSources') ? 'extract' : 'extract_only'}:${archId}`;
    const appPrefix = `${config.appHost}/${user}/${coll}/${rec}/${extractFrag}/`;
    const contentPrefix = `${config.contentHost}/${user}/${coll}/${rec}/${extractFrag}/`;

    return (
      <div>
        <ReplayUI
          activeCollection={activeCollection}
          params={params} />

        {
          activeBrowser ?
            <RemoteBrowser
              dispatch={dispatch}
              mode={this.mode}
              params={params}
              rb={activeBrowser}
              rec={rec}
              recId={reqId} /> :
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
    // set url and ts in store
    promise: ({ params: { extractMode, archiveId, collId, ts, splat }, store: { dispatch, getState } }) => {
      dispatch(getArchives()).then(() => {
        const state = getState();
        const archives = state.getIn(['controls', 'archives']);

        const promises = [
          dispatch(updateUrl(splat)),
          dispatch(updateTimestamp(ts)),
          dispatch(setExtractable({
            allSources: extractMode === 'extract',
            archive: archives.get(archiveId),
            id: archiveId,
            targetColl: collId,
            targetUrl: splat,
            timestamp: ts
          }))
        ];

        return Promise.all(promises);
      });
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
  },
  {
    // set active collection
    promise: ({ params: { coll }, store: { dispatch }}) => {
      return dispatch(selectCollection(coll));
    }
  }
];

const mapStateToProps = (state) => {
  return {
    activeBrowser: state.getIn(['remoteBrowsers', 'activeBrowser']),
    activeCollection: getActiveCollection(state),
    auth: state.get('auth'),
    collection: state.get('collection'),
    extractable: state.getIn(['controls', 'extractable']),
    reqId: state.getIn(['remoteBrowsers', 'reqId']),
    timestamp: state.getIn(['controls', 'timestamp']),
    url: state.getIn(['controls', 'url'])
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps
)(Extract);
