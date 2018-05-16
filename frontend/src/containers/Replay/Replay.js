import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Helmet from 'react-helmet';
import ReactGA from 'react-ga';
import { asyncConnect } from 'redux-connect';
import { batchActions } from 'redux-batched-actions';

import { remoteBrowserMod } from 'helpers/utils';
import config from 'config';

import { getActivePage } from 'redux/selectors';
import { isLoaded, load as loadColl } from 'redux/modules/collection';
import { getArchives, setBookmarkId, setListId, updateUrl, updateUrlAndTimestamp } from 'redux/modules/controls';
import { resetStats } from 'redux/modules/infoStats';
import { listLoaded, load as loadList } from 'redux/modules/list';
import { load as loadBrowsers, isLoaded as isRBLoaded, setBrowser } from 'redux/modules/remoteBrowsers';
import { toggle as toggleSidebar } from 'redux/modules/sidebar';

import HttpStatus from 'components/HttpStatus';
import Resizable from 'components/Resizable';
import { InspectorPanel, RemoteBrowser, Sidebar, SidebarListViewer,
         SidebarCollectionViewer, SidebarPageViewer } from 'containers';
import { IFrame, ReplayUI } from 'components/controls';


class Replay extends Component {
  static contextTypes = {
    product: PropTypes.string
  };

  static propTypes = {
    activeBookmarkId: PropTypes.string,
    activeBrowser: PropTypes.string,
    autoscroll: PropTypes.bool,
    auth: PropTypes.object,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    expanded: PropTypes.bool,
    loaded: PropTypes.bool,
    match: PropTypes.object,
    recording: PropTypes.string,
    reqId: PropTypes.string,
    sidebarResize: PropTypes.bool,
    timestamp: PropTypes.string,
    toggleSidebar: PropTypes.func,
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
    this.state = { collectionNav: false };
  }

  getChildContext() {
    const { auth, match: { params: { user } } } = this.props;

    return {
      currMode: this.mode,
      canAdmin: auth.getIn(['user', 'username']) === user
    };
  }

  componentWillReceiveProps(nextProps) {
    if (config.gaId && this.props.loaded) {
      const { activeBrowser, match: { params }, timestamp, url } = nextProps;
      const tsMod = remoteBrowserMod(activeBrowser, timestamp);
      const nextUrl = params.listId ?
        `/${params.user}/${params.coll}/list/${params.listId}-${params.bookmarkId}/${tsMod}/${url}` :
        `/${params.user}/${params.coll}/${tsMod}/${url}`;

      ReactGA.set({ page: nextUrl });
      ReactGA.pageview(nextUrl);
    }

    const { match: { params: { listId } } } = this.props;
    if (listId !== nextProps.match.params.listId && this.state.collectionNav) {
      this.setState({ collectionNav: false });
    }
  }

  shouldComponentUpdate(nextProps) {
    // don't rerender for loading changes
    if (!nextProps.loaded) {
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

  showCollectionNav = (bool = true) => {
    this.setState({ collectionNav: bool });
  }

  render() {
    const { activeBookmarkId, activeBrowser, collection, dispatch, match: { params }, recording,
            reqId, timestamp, url } = this.props;
    const { product } = this.context;

    if (collection.get('error')) {
      return (
        <HttpStatus>
          {collection.getIn(['error', 'error_message'])}
        </HttpStatus>
      );
    }

    const tsMod = remoteBrowserMod(activeBrowser, timestamp);
    const listId = params.listId;
    const bkId = params.bookmarkId;

    const shareUrl = listId ?
      `${config.appHost}${params.user}/${params.coll}/list/${listId}-${bkId}/${tsMod}/${url}` :
      `${config.appHost}${params.user}/${params.coll}/${tsMod}/${url}`;

    if (!collection.get('loaded')) {
      return null;
    }

    const navigator = listId ?
      <SidebarListViewer showNavigator={this.showCollectionNav} /> :
      <SidebarPageViewer showNavigator={this.showCollectionNav} />;

    return (
      <React.Fragment>
        <Helmet>
          <meta property="og:url" content={shareUrl} />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={`Archived page from the &ldquo;${collection.get('title')}&rdquo; Collection on ${product}`} />
          <meta name="og:description" content={collection.get('desc') ? collection.getIn(['collection', 'desc']) : 'Create high-fidelity, interactive web archives of any web site you browse.'} />
        </Helmet>

        <ReplayUI
          activeBrowser={activeBrowser}
          params={params}
          timestamp={timestamp}
          sidebarExpanded={this.props.expanded}
          toggle={this.props.toggleSidebar}
          url={url} />
        <div className="iframe-container">
          <Sidebar storageKey="replaySidebar">
            <Resizable axis="y" minHeight={200} storageKey="replayNavigator">
              {
                this.state.collectionNav ?
                  (<SidebarCollectionViewer
                    activeListId={listId}
                    showNavigator={this.showCollectionNav} />) :
                  navigator
              }
            </Resizable>
            <InspectorPanel />
          </Sidebar>
          {
            activeBrowser ?
              <RemoteBrowser
                dispatch={dispatch}
                params={params}
                rb={activeBrowser}
                rec={recording}
                reqId={reqId}
                timestamp={timestamp}
                url={url} /> :
              <IFrame
                activeBookmarkId={activeBookmarkId}
                autoscroll={this.props.autoscroll}
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

const mapStateToProps = (outerState) => {
  const { reduxAsyncConnect: { loaded }, app } = outerState;
  const activePage = app.getIn(['collection', 'loaded']) ? getActivePage(outerState) : null;

  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    activeBookmarkId: app.getIn(['controls', 'activeBookmarkId']),
    autoscroll: app.getIn(['controls', 'autoscroll']),
    auth: app.get('auth'),
    collection: app.get('collection'),
    expanded: app.getIn(['sidebar', 'expanded']),
    loaded,
    recording: activePage ? activePage.get('rec') : null,
    reqId: app.getIn(['remoteBrowsers', 'reqId']),
    sidebarResize: app.getIn(['sidebar', 'resizing']),
    timestamp: app.getIn(['controls', 'timestamp']),
    url: app.getIn(['controls', 'url'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    toggleSidebar: b => dispatch(toggleSidebar(b)),
    dispatch
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps,
  mapDispatchToProps
)(Replay);
