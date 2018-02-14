import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { asyncConnect } from 'redux-connect';

import { remoteBrowserMod, truncate } from 'helpers/utils';
import config from 'config';

import { getRecording } from 'redux/selectors';
import { isLoaded, load as loadColl } from 'redux/modules/collection';
import { getArchives, updateUrl, updateUrlAndTimestamp } from 'redux/modules/controls';
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
    recording: PropTypes.object,
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
    const { auth, match: { params: { user } } } = this.props;

    return {
      currMode: this.mode,
      canAdmin: auth.getIn(['user', 'username']) === user
    };
  }

  componentWillUnmount() {
    // clear info stats
    this.props.dispatch(resetStats());
  }

  render() {
    const { activeBrowser, collection, dispatch, match: { params }, recording,
            reqId, sidebarResize, timestamp, url } = this.props;
    const { product } = this.context;

    const tsMod = remoteBrowserMod(activeBrowser, timestamp);

    const shareUrl = `${config.appHost}${params.user}/${params.coll}/${tsMod}/${url}`;
    const appPrefix = `${config.appHost}/${params.user}/${params.coll}/`;
    const contentPrefix = `${config.contentHost}/${params.user}/${params.coll}/`;

    if (!collection.get('loaded')) {
      return null;
    }

    return (
      <React.Fragment>
        <Helmet>
          <meta property="og:url" content={shareUrl} />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={`Archived page from the &ldquo;${collection.get('title')}&rdquo; Collection on ${product}`} />
          <meta name="og:description" content={collection.get('desc') ? collection.getIn(['collection', 'desc']) : 'Create high-fidelity, interactive web archives of any web site you browse.'} />
        </Helmet>

        <ReplayUI
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
    promise: ({ location: { hash, search }, match: { params: { br, ts, splat } }, store: { dispatch } }) => {
      const compositeUrl = `${splat}${search || ''}${hash || ''}`;
      const promises = [
        ts ? dispatch(updateUrlAndTimestamp(compositeUrl, ts)) : dispatch(updateUrl(compositeUrl)),
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
    collection: app.get('collection'),
    recording: app.getIn(['recordings', 'loaded']) ? getRecording(app) : null,
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
