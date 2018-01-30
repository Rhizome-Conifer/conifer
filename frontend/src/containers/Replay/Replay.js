import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { asyncConnect } from 'redux-connect';

import { remoteBrowserMod, truncate } from 'helpers/utils';
import config from 'config';

import { getOrderedBookmarks, getActiveRecording, getRecording } from 'redux/selectors';
import { isLoaded, load as loadColl } from 'redux/modules/collection';
import { getArchives, updateUrlAndTimestamp } from 'redux/modules/controls';
import { resetStats } from 'redux/modules/infoStats';
import { createRemoteBrowser, load as loadBrowsers, setBrowser } from 'redux/modules/remoteBrowsers';

import { RemoteBrowser, Sidebar } from 'containers';
import { IFrame, ReplayUI } from 'components/controls';


class Replay extends Component {
  static contextTypes = {
    product: PropTypes.string
  };

  static propTypes = {
    activeBrowser: PropTypes.string,
    auth: PropTypes.object,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    bookmarks: PropTypes.object,
    recording: PropTypes.object,
    recordingIndex: PropTypes.number,
    reqId: PropTypes.string,
    match: PropTypes.object,
    sidebarResize: PropTypes.bool,
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


    // TODO: unify replay and replay-coll
    this.mode = 'replay-coll';
  }

  getChildContext() {
    const { auth, match: { params } } = this.props;

    return {
      currMode: this.mode,
      canAdmin: auth.getIn(['user', 'username']) === params.user
    };
  }

  componentWillUnmount() {
    // clear info stats
    this.props.dispatch(resetStats());
  }

  render() {
    const { activeBrowser, bookmarks, collection, dispatch, match: { params }, recording,
            recordingIndex, reqId, sidebarResize, timestamp, url } = this.props;
    const { product } = this.context;

    const tsMod = remoteBrowserMod(activeBrowser, timestamp);

    const shareUrl = `${config.host}${params.user}/${params.coll}/${tsMod}/${url}`;
    const appPrefix = `${config.appHost}/${params.user}/${params.coll}/`;
    const contentPrefix = `${config.contentHost}/${params.user}/${params.coll}/`;

    return (
      <React.Fragment>
        <Helmet>
          <meta property="og:url" content={shareUrl} />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={`Archived page from the &ldquo;${collection.get('title')}&rdquo; Collection on ${product}`} />
          <meta name="og:description" content={collection.get('desc') ? collection.getIn(['collection', 'desc']) : 'Create high-fidelity, interactive web archives of any web site you browse.'} />
        </Helmet>

        <ReplayUI
          bookmarks={bookmarks}
          recordingIndex={recordingIndex}
          params={params}
          timestamp={timestamp}
          url={url} />
        <div className="iframe-container">
          <Sidebar />
          {
            activeBrowser ?
              <RemoteBrowser
                dispatch={dispatch}
                params={params}
                rb={activeBrowser}
                rec={recording ? recording.get('id') : null}
                reqId={reqId}
                timestamp={timestamp}
                url={url} /> :
              <IFrame
                appPrefix={appPrefix}
                contentPrefix={contentPrefix}
                dispatch={dispatch}
                params={params}
                passEvents={sidebarResize}
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
    promise: ({ store: { dispatch } }) => {
      return dispatch(loadBrowsers());
    }
  },
  {
    // set url and ts in store
    promise: ({ location: { hash, search }, match: { params: { ts, splat } }, store: { dispatch } }) => {
      let timestamp = ts;
      let rb = null;

      if (ts.indexOf('$br:') !== -1) {
        const parts = ts.split('$br:');
        timestamp = parts[0];
        rb = parts[1];
      }

      const compositeUrl = `${splat}${search || ''}${hash || ''}`;
      console.log(splat, search, hash, timestamp);
      const promises = [
        dispatch(updateUrlAndTimestamp(compositeUrl, timestamp)),
        dispatch(setBrowser(rb))
      ];

      return Promise.all(promises);
    }
  },
  {
    promise: ({ match: { params }, store: { dispatch, getState } }) => {
      const state = getState();
      const collection = state.app.get('collection');
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
    bookmarks: getOrderedBookmarks(app),
    collection: app.get('collection'),
    recording: getRecording(app),
    recordingIndex: getActiveRecording(app),
    reqId: app.getIn(['remoteBrowsers', 'reqId']),
    sidebarResize: app.getIn(['sidebar', 'resizing']),
    timestamp: app.getIn(['controls', 'timestamp']),
    url: app.getIn(['controls', 'url'])
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps
)(Replay);
