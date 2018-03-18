import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import { asyncConnect } from 'redux-connect';
import { batchActions } from 'redux-batched-actions';

import { remoteBrowserMod, truncate } from 'helpers/utils';
import config from 'config';

import { getRecording } from 'redux/selectors';
import { isLoaded, load as loadColl } from 'redux/modules/collection';
import { getArchives, setBookmarkId, setListId, updateUrl, updateUrlAndTimestamp } from 'redux/modules/controls';
import { resetStats } from 'redux/modules/infoStats';
import { listLoaded, load as loadList } from 'redux/modules/list';
import { load as loadBrowsers, isLoaded as isRBLoaded, setBrowser } from 'redux/modules/remoteBrowsers';

import { RemoteBrowser, Sidebar, SidebarListViewer, SidebarPageViewer } from 'containers';
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
    match: PropTypes.object,
    recording: PropTypes.object,
    reqId: PropTypes.string,
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

  shouldComponentUpdate(nextProps) {
    // don't rerender for loading changes
    if (this.props.loaded !== nextProps.loaded) {
      return false;
    }

    return true;
  }

  componentWillUnmount() {
    // clear info stats
    this.props.dispatch(resetStats());
  }

  getAppPrefix = () => {
    const { activeBookmarkId, match: { params: { user, coll, listId } } } = this.props;
    return listId ?
      `${config.appHost}/${user}/${coll}/list/${listId}-${activeBookmarkId}/` :
      `${config.appHost}/${user}/${coll}/`;
  }

  getContentPrefix = () => {
    const { activeBookmarkId, match: { params: { user, coll, listId } } } = this.props;
    return listId ?
      `${config.contentHost}/${user}/${coll}/list/${listId}-${activeBookmarkId}/` :
      `${config.contentHost}/${user}/${coll}/`;
  }

  render() {
    const { activeBookmarkId, activeBrowser, collection, dispatch, match: { params }, recording,
            reqId, timestamp, url } = this.props;
    const { product } = this.context;

    const tsMod = remoteBrowserMod(activeBrowser, timestamp);
    const listId = params.listId;
    const bkId = params.bookmarkId;

    const shareUrl = listId ?
      `${config.appHost}${params.user}/${params.coll}/list/${listId}-${bkId}/${tsMod}/${url}` :
      `${config.appHost}${params.user}/${params.coll}/${tsMod}/${url}`;

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
          <Sidebar>
            {
              listId ?
                <SidebarListViewer /> :
                <SidebarPageViewer />
            }
          </Sidebar>
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
                activeBookmarkId={activeBookmarkId}
                appPrefix={this.getAppPrefix}
                contentPrefix={this.getContentPrefix}
                dispatch={dispatch}
                params={params}
                passEvents={this.props.sidebarResize}
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
      if (!isRBLoaded(getState())) {
        return dispatch(loadBrowsers());
      }

      return undefined;
    }
  },
  {
    // set url, ts, list and bookmark id in store
    promise: ({ location: { hash, search }, match: { params: { bookmarkId, br, listId, ts, splat } }, store: { dispatch } }) => {
      const compositeUrl = `${splat}${search || ''}${hash || ''}`;

      return dispatch(batchActions([
        ts ? updateUrlAndTimestamp(compositeUrl, ts) : updateUrl(compositeUrl),
        setBrowser(br || null),
        setListId(listId || null),
        setBookmarkId(bookmarkId || null)
      ]));
    }
  },
  {
    // check for list playback, load list
    promise: ({ match: { params: { user, coll, listId } }, store: { dispatch, getState } }) => {
      if (listId && !listLoaded(listId, getState())) {
        return dispatch(loadList(user, coll, listId));
      }

      return undefined;
    }
  },
  {
    promise: ({ match: { params }, store: { dispatch, getState } }) => {
      const state = getState();
      const collection = state.app.get('collection');
      const { user, coll } = params;

      if(!isLoaded(state) || collection.get('id') !== coll) {
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

const mapStateToProps = ({ reduxAsyncConnect: { loaded }, app }) => {
  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    activeBookmarkId: app.getIn(['controls', 'activeBookmarkId']),
    auth: app.get('auth'),
    collection: app.get('collection'),
    loaded,
    recording: app.getIn(['collection', 'loaded']) ? getRecording(app) : null,
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
