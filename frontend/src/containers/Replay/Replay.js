import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import Helmet from 'react-helmet';
import { asyncConnect } from 'redux-connect';
import { batchActions } from 'redux-batched-actions';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';

import { getCollectionLink, remoteBrowserMod, truncate } from 'helpers/utils';
import config from 'config';

import { getActivePage } from 'store/selectors';
import { isLoaded, load as loadColl } from 'store/modules/collection';
import { getArchives, setBookmarkId, setList, updateUrl, updateUrlAndTimestamp } from 'store/modules/controls';
import { resetStats } from 'store/modules/infoStats';
import { listLoaded, load as loadList } from 'store/modules/list';
import { load as loadBrowsers, isLoaded as isRBLoaded, setBrowser } from 'store/modules/remoteBrowsers';
import { toggle as toggleSidebar } from 'store/modules/sidebar';

import EmbedFooter from 'components/EmbedFooter';
import HttpStatus from 'components/HttpStatus';
import RedirectWithStatus from 'components/RedirectWithStatus';
import Resizable from 'components/Resizable';
import { InspectorPanel, RemoteBrowser, Sidebar, SidebarListViewer, SidebarCollectionViewer, SidebarPageViewer } from 'containers';
import { IFrame, ReplayUI } from 'components/controls';


let Webview;
if (__PLAYER__) {
  Webview = require('components/player/Webview');
}


class Replay extends Component {
  static contextTypes = {
    isEmbed: PropTypes.bool,
    isMobile: PropTypes.bool
  };

  static propTypes = {
    activeBookmarkId: PropTypes.string,
    activeBrowser: PropTypes.string,
    appSettings: PropTypes.object,
    autoscroll: PropTypes.bool,
    auth: PropTypes.object,
    collection: PropTypes.object,
    dispatch: PropTypes.func,
    expanded: PropTypes.bool,
    list: PropTypes.object,
    loaded: PropTypes.bool,
    match: PropTypes.object,
    recording: PropTypes.string,
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
    this.state = { collectionNav: !props.match.params.listSlug };
  }

  getChildContext() {
    const { auth, match: { params: { user } } } = this.props;

    return {
      currMode: this.mode,
      canAdmin: auth.getIn(['user', 'username']) === user
    };
  }

  componentWillReceiveProps(nextProps) {
    const { match: { params: { listSlug } } } = this.props;
    if (listSlug !== nextProps.match.params.listSlug && this.state.collectionNav) {
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
    const { activeBookmarkId, match: { params: { user, coll, listSlug } } } = this.props;
    return listSlug ?
      `${config.appHost}/${user}/${coll}/list/${listSlug}/b${activeBookmarkId}/` :
      `${config.appHost}/${user}/${coll}/`;
  }

  getContentPrefix = () => {
    const { activeBookmarkId, match: { params: { user, coll, listSlug } } } = this.props;
    return listSlug ?
      `${config.contentHost}/${user}/${coll}/list/${listSlug}/b${activeBookmarkId}/` :
      `${config.contentHost}/${user}/${coll}/`;
  }

  showCollectionNav = (bool = true) => {
    this.setState({ collectionNav: bool });
  }

  render() {
    const {
      activeBookmarkId,
      activeBrowser,
      appSettings,
      collection,
      dispatch,
      list,
      match: { params },
      recording,
      timestamp,
      url
    } = this.props;

    // coll access
    if (collection.get('error')) {
      return (
        <HttpStatus>
          {collection.getIn(['error', 'error_message'])}
        </HttpStatus>
      );
    } else if (collection.get('loaded') && !collection.get('slug_matched') && params.coll !== collection.get('slug')) {
      return (
        <RedirectWithStatus
          to={`${getCollectionLink(collection)}/${remoteBrowserMod(activeBrowser, timestamp)}/${url}`}
          status={301} />
      );
    }

    // list access
    if (params.listSlug && (list.get('error') || (!list.get('slug_matched') && params.listSlug !== list.get('slug')))) {
      if (list.get('loaded') && !list.get('slug_matched')) {
        return (
          <RedirectWithStatus
            to={`${getCollectionLink(collection)}/list/${list.get('slug')}/b${activeBookmarkId}/${timestamp}/${url}`}
            status={301} />
        );
      }
      return (
        <HttpStatus>
          {
            list.get('error') === 'no_such_list' &&
              <span>Sorry, we couldn't find that list.</span>
          }
        </HttpStatus>
      );
    }

    const tsMod = remoteBrowserMod(activeBrowser, timestamp);
    const { listSlug } = params;
    const bkId = params.bookmarkId;

    const shareUrl = listSlug ?
      `${config.appHost}${params.user}/${params.coll}/list/${listSlug}/b${bkId}/${tsMod}/${url}` :
      `${config.appHost}${params.user}/${params.coll}/${tsMod}/${url}`;

    if (!collection.get('loaded')) {
      return null;
    }

    const title = listSlug ? `Archived page from the “${list.get('title')}” List on ${config.product}` : `Archived page from the “${collection.get('title')}” Collection on ${config.product}`;
    const desc = listSlug ?
      <meta property="og:description" content={list.get('desc') ? truncate(list.get('desc'), 3, new RegExp(/([.!?])/)) : config.tagline} /> :
      <meta property="og:description" content={collection.get('desc') ? truncate(collection.get('desc'), 3, new RegExp(/([.!?])/)) : config.tagline} />;

    return (
      <React.Fragment>
        <Helmet>
          <title>{title}</title>
          <meta property="og:url" content={shareUrl} />
          <meta property="og:type" content="website" />
          <meta property="og:title" content={title} />
          {desc}
        </Helmet>
        {
          !this.context.isEmbed &&
            <ReplayUI
              activeBrowser={activeBrowser}
              params={params}
              timestamp={timestamp}
              sidebarExpanded={this.props.expanded}
              toggle={this.props.toggleSidebar}
              url={url} />
        }
        <div className={classNames('iframe-container', { embed: this.context.isEmbed && params.embed !== '_embed_noborder' })}>
          {
            !this.context.isMobile && !this.context.isEmbed &&
              <Sidebar defaultExpanded={Boolean(listSlug) || __PLAYER__} storageKey={listSlug ? 'listReplaySidebar' : 'pageReplaySidebar'}>
                <Resizable axis="y" minHeight={200} storageKey="replayNavigator">
                  <Tabs defaultIndex={listSlug ? 0 : 1}>
                    <TabList>
                      <Tab>Lists</Tab>
                      {
                        collection.get('public_index') &&
                          <Tab>Browse All</Tab>
                      }
                    </TabList>
                    <TabPanel>
                      {
                        this.state.collectionNav ?
                          (<SidebarCollectionViewer
                            activeList={listSlug}
                            showNavigator={this.showCollectionNav} />) :
                          <SidebarListViewer showNavigator={this.showCollectionNav} />
                      }
                    </TabPanel>
                    <TabPanel>
                      <SidebarPageViewer showNavigator={this.showCollectionNav} />
                    </TabPanel>
                  </Tabs>
                </Resizable>
                <InspectorPanel />
              </Sidebar>
          }
          {
            __PLAYER__ &&
              <Webview
                key="webview"
                host={appSettings.get('host')}
                params={params}
                dispatch={dispatch}
                timestamp={timestamp}
                canGoBackward={appSettings.get('canGoBackward')}
                canGoForward={appSettings.get('canGoForward')}
                url={url} />
          }
          {

            this.context.isEmbed && params.embed !== '_embed_noborder' &&
              <EmbedFooter timestamp={timestamp} />
          }
          {
            !__PLAYER__ && (
              activeBrowser ?
                <RemoteBrowser
                  params={params}
                  rb={activeBrowser}
                  rec={recording}
                  timestamp={timestamp}
                  url={url} /> :
                <IFrame
                  activeBookmarkId={activeBookmarkId}
                  auth={this.props.auth}
                  autoscroll={this.props.autoscroll}
                  appPrefix={this.getAppPrefix}
                  contentPrefix={this.getContentPrefix}
                  dispatch={dispatch}
                  params={params}
                  passEvents={this.props.sidebarResize}
                  timestamp={timestamp}
                  url={url} />
            )
          }
        </div>
      </React.Fragment>
    );
  }
}

const initialData = [
  {
    promise: ({ store: { dispatch, getState } }) => {
      const state = getState();
      if (!isRBLoaded(state) && !__PLAYER__) {
        return dispatch(loadBrowsers());
      }

      return undefined;
    }
  },
  {
    // set url, ts, list and bookmark id in store
    promise: ({ location: { hash, search }, match: { params: { bookmarkId, br, listSlug, ts, splat } }, store: { dispatch } }) => {
      const compositeUrl = `${splat}${search || ''}${hash || ''}`;

      return dispatch(batchActions([
        ts ? updateUrlAndTimestamp(compositeUrl, ts) : updateUrl(compositeUrl),
        setBrowser(br || null),
        setList(listSlug || null),
        setBookmarkId(bookmarkId || null)
      ]));
    }
  },
  {
    // check for list playback, load list
    promise: ({ match: { params: { user, coll, listSlug } }, store: { dispatch, getState } }) => {
      const state = getState();
      if (listSlug && !listLoaded(listSlug, state)) {
        let host = '';

        if (__PLAYER__) {
          host = state.app.getIn(['appSettings', 'host']);
        }

        return dispatch(loadList(user, coll, listSlug, host));
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
        let host = '';

        if (__PLAYER__) {
          host = state.app.getIn(['appSettings', 'host']);
        }

        return dispatch(loadColl(user, coll, host));
      }

      return undefined;
    }
  },
  {
    promise: ({ store: { dispatch, getState } }) => {
      const { app } = getState();

      // TODO: determine if we need to test for stale archives
      if (!app.getIn(['controls', 'archives']).size) {
        let host = '';

        if (__PLAYER__) {
          host = app.getIn(['appSettings', 'host']);
        }
        return dispatch(getArchives(host));
      }

      return undefined;
    }
  }
];

const mapStateToProps = (outerState) => {
  const { reduxAsyncConnect: { loaded }, app } = outerState;
  const activePage = app.getIn(['collection', 'loaded']) ? getActivePage(outerState) : null;
  let appSettings = null;

  if (__PLAYER__) {
    appSettings = app.get('appSettings');
  }

  return {
    activeBrowser: app.getIn(['remoteBrowsers', 'activeBrowser']),
    activeBookmarkId: app.getIn(['controls', 'activeBookmarkId']),
    appSettings,
    autoscroll: app.getIn(['controls', 'autoscroll']),
    auth: app.get('auth'),
    collection: app.get('collection'),
    expanded: app.getIn(['sidebar', 'expanded']),
    list: app.get('list'),
    loaded,
    recording: activePage ? activePage.get('rec') : null,
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
