import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';
import { batchActions } from 'redux-batched-actions';


import config from 'config';

import { selectCollection } from 'store/modules/auth';
import { isLoaded, load as loadColl } from 'store/modules/collection';
import { getArchives, setExtractable, updateUrlAndTimestamp } from 'store/modules/controls';
import { resetStats } from 'store/modules/infoStats';
import { load as loadBrowsers, isLoaded as isRBLoaded, setBrowser } from 'store/modules/remoteBrowsers';
import { getActiveCollection } from 'store/selectors';

import { RemoteBrowser } from 'containers';
import { IFrame, ReplayUI } from 'components/controls';


class Extract extends Component {
  static contextTypes = {
    product: PropTypes.string
  };

  static propTypes = {
    activeBrowser: PropTypes.string,
    activeCollection: PropTypes.object,
    auth: PropTypes.object,
    autoscroll: PropTypes.bool,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    extractable: PropTypes.object,
    match: PropTypes.object,
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

    this.mode = props.match.params.extractMode;
  }

  getChildContext() {
    const { auth, match: { params: { extractMode, user } } } = this.props;

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
    const { activeBrowser, activeCollection, dispatch, extractable, match: { params }, timestamp, url } = this.props;
    const { user, coll, rec } = params;

    const archId = extractable.get('id');
    const extractFrag = `${extractable.get('allSources') ? 'extract' : 'extract_only'}:${archId}`;
    const appPrefix = `${config.appHost}/${user}/${coll}/${rec}/${extractFrag}/`;
    const contentPrefix = `${config.contentHost}/${user}/${coll}/${rec}/${extractFrag}/`;

    return (
      <React.Fragment>
        <ReplayUI
          activeCollection={activeCollection}
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
    promise: ({ location: { hash, search }, match: { params: { archiveId, br, coll, collId, extractMode, splat, ts } }, store: { dispatch, getState } }) => {
      dispatch(getArchives()).then(() => {
        const state = getState().app;
        const archives = state.getIn(['controls', 'archives']);
        const compositeUrl = `${splat}${search || ''}${hash || ''}`;

        return dispatch(batchActions([
          updateUrlAndTimestamp(compositeUrl, ts),
          setBrowser(br || null),
          selectCollection(coll),
          setExtractable({
            allSources: extractMode === 'extract',
            archive: archives.get(archiveId),
            id: archiveId,
            targetColl: collId ? collId.replace(':', '') : null,
            targetUrl: splat,
            timestamp: ts
          })
        ]));
      });
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
      const state = getState().app;

      // TODO: determine if we need to test for stale archives
      if (!state.getIn(['controls', 'archives']).size) {
        return dispatch(getArchives());
      }

      return undefined;
    }
  }
];

const mapStateToProps = ({ app }) => {
  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    activeCollection: getActiveCollection(app),
    auth: app.get('auth'),
    autoscroll: app.getIn(['controls', 'autoscroll']),
    collection: app.get('collection'),
    extractable: app.getIn(['controls', 'extractable']),
    timestamp: app.getIn(['controls', 'timestamp']),
    url: app.getIn(['controls', 'url'])
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps
)(Extract);
