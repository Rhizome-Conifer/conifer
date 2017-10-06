import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { asyncConnect } from 'redux-connect';
import { BreadcrumbsItem } from 'react-breadcrumbs-dynamic';

import { truncate } from 'helpers/utils';
import config from 'config';

import { getOrderedBookmarks, getActiveRecording, getRecording } from 'redux/selectors';
import { isLoaded, load as loadColl } from 'redux/modules/collection';
import { getArchives, updateUrl, updateTimestamp } from 'redux/modules/controls';
import { createRemoteBrowser } from 'redux/modules/remoteBrowsers';

import { RemoteBrowser } from 'containers';
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
    recordingIndex: PropTypes.number,
    reqId: PropTypes.string,
    params: PropTypes.object,
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

    this.mode = 'replay';
    this.lastProps = null;
  }

  getChildContext() {
    const { auth, params } = this.props;

    return {
      currMode: this.mode,
      canAdmin: auth.getIn(['user', 'username']) === params.user
    };
  }

  render() {
    const { activeBrowser, bookmarks, collection, dispatch, params, recording,
            recordingIndex, reqId, timestamp, url } = this.props;
    const { product } = this.context;

    const shareUrl = `${config.host}${params.user}/${params.coll}/${params.ts}/${params.splat}`;
    const appPrefix = `${config.appHost}/${params.user}/${params.coll}/`;
    const contentPrefix = `${config.contentHost}/${params.user}/${params.coll}/`;

    return (
      <div>
        <Helmet>
          <meta property="og:url" content={url} />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={`Archived page from the &ldquo;${collection.get('title')}&rdquo; Collection on ${product}`} />
          <meta name="og:description" content={collection.get('desc') ? collection.getIn(['collection', 'desc']) : 'Create high-fidelity, interactive web archives of any web site you browse.'} />
        </Helmet>

        <BreadcrumbsItem to={`/${params.user}`}>{ params.user }</BreadcrumbsItem>
        <BreadcrumbsItem to={`/${params.user}/${params.coll}`}>{ truncate(collection.get('title'))}</BreadcrumbsItem>

        <ReplayUI
          bookmarks={bookmarks}
          recordingIndex={recordingIndex}
          params={params}
          timestamp={timestamp}
          url={url} />

        {
          activeBrowser ?
            <RemoteBrowser
              dispatch={dispatch}
              mode={this.mode}
              params={params}
              rb={activeBrowser}
              rec={recording ? recording.get('id') : null}
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
    promise: ({ params: { ts, splat }, store: { dispatch } }) => {
      const promises = [
        dispatch(updateUrl(splat)),
        dispatch(updateTimestamp(ts))
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
    promise: ({ params: { coll, rec, ts, splat }, store: { dispatch, getState } }) => {
      const state = getState();
      const rb = state.getIn(['remoteBrowsers', 'activeBrowser']);
      const urlFrag = `${ts}/${splat}`;

      // if remote browser is active, load up a new instance
      if (rb) {
        return dispatch(createRemoteBrowser(rb, coll, rec, this.mode, urlFrag));
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

const mapStateToProps = (state, props) => {
  return {
    activeBrowser: state.getIn(['remoteBrowsers', 'activeBrowser']),
    auth: state.get('auth'),
    bookmarks: getOrderedBookmarks(state),
    collection: state.get('collection'),
    recording: getRecording(state),
    recordingIndex: getActiveRecording(state),
    reqId: state.getIn(['remoteBrowsers', 'reqId']),
    timestamp: state.getIn(['controls', 'timestamp']),
    url: state.getIn(['controls', 'url'])
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps
)(Replay);
