import React, { Component } from 'react';
import PropTypes from 'prop-types';
import querystring from 'querystring';
import { asyncConnect } from 'redux-connect';
import { createSearchAction } from 'redux-search';
import { Map } from 'immutable';

import { isLoaded as isCollLoaded, getBookmarkCount, load as loadColl } from 'store/modules/collection';
import { clear, multiSelect, selectBookmark, selectPage } from 'store/modules/inspector';
import { load as loadList, removeBookmark, bookmarkSort } from 'store/modules/list';
import { setQueryMode } from 'store/modules/pageQuery';
import { isLoaded as isRBLoaded, load as loadRB } from 'store/modules/remoteBrowsers';

import { getQueryPages, getOrderedPages } from 'store/selectors';
import { pageSearchResults } from 'store/selectors/search';

import CollectionDetailUI from 'components/collection/CollectionDetailUI';


class CollectionDetail extends Component {

  static propTypes = {
    auth: PropTypes.object,
    collection: PropTypes.object,
    match: PropTypes.object
  };

  // TODO: update to new context api
  static childContextTypes = {
    asPublic: PropTypes.bool,
    canAdmin: PropTypes.bool
  };

  getChildContext() {
    const { auth, location: { search }, match: { params: { user } } } = this.props;
    const username = auth.getIn(['user', 'username']);

    const asPublic = search ? search.indexOf('asPublic') !== -1 : false;

    return {
      canAdmin: username === user && !asPublic,
      asPublic
    };
  }

  render() {
    return (
      <CollectionDetailUI {...this.props} />
    );
  }
}


const initialData = [
  {
    promise: ({ location: { search }, store: { dispatch } }) => {
      if (search) {
        const qs = querystring.parse(search.replace(/^\?/, ''));

        if (qs.query && qs.query.includes(':')) {
          const [column, str] = qs.query.split(':');
          dispatch(setQueryMode(true, column, str));
        }
      }

      return undefined;
    }
  },
  {
    promise: ({ match: { params: { coll, list, user } }, store: { dispatch, getState } }) => {
      const state = getState();

      // if switching to list view, prevent reloading collection
      if ((!isCollLoaded(state) || state.app.getIn(['collection', 'id']) !== coll) || !list) {
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
    promise: ({ match: { params: { coll, list, user } }, store: { dispatch, getState } }) => {
      const { app } = getState();

      if (list) {
        let host = '';

        if (__PLAYER__) {
          host = app.getIn(['appSettings', 'host']);
        }

        return dispatch(loadList(user, coll, list, host));
      }

      return undefined;
    }
  },
  {
    promise: ({ store: { dispatch, getState } }) => {
      const state = getState();

      if (!isRBLoaded(state) && !__PLAYER__) {
        return dispatch(loadRB());
      }

      return undefined;
    }
  }
];

const mapStateToProps = (outerState) => {
  const { app, reduxAsyncConnect } = outerState;
  const isLoaded = app.getIn(['collection', 'loaded']);
  const { pageFeed, searchText } = isLoaded ? pageSearchResults(outerState) : { pageFeed: Map(), searchText: '' };
  const isIndexing = isLoaded && !pageFeed.size && app.getIn(['collection', 'pages']).size && !searchText;

  const querying = app.getIn(['pageQuery', 'querying']);
  let pages;

  if (querying) {
    pages = getQueryPages(app);
  } else {
    pages = isIndexing ? getOrderedPages(app) : pageFeed;
  }

  return {
    auth: app.get('auth'),
    browsers: app.get('remoteBrowsers'),
    bkDeleting: app.getIn(['list', 'bkDeleting']),
    bkDeleteError: app.getIn(['list', 'bkDeleteError']),
    collection: app.get('collection'),
    list: app.get('list'),
    loaded: reduxAsyncConnect.loaded,
    pages,
    publicIndex: app.getIn(['collection', 'public_index']),
    searchText
  };
};

const mapDispatchToProps = (dispatch, { match: { params: { user, coll } } }) => {
  return {
    clearInspector: () => dispatch(clear()),
    clearQuery: () => dispatch(setQueryMode(false)),
    clearSearch: () => dispatch(createSearchAction('collection.pages')('')),
    setMultiInspector: count => dispatch(multiSelect(count)),
    setPageInspector: fields => dispatch(selectPage(fields)),
    setBookmarkInspector: bk => dispatch(selectBookmark(bk)),
    removeBookmark: (list, id) => {
      dispatch(removeBookmark(user, coll, list, id))
        .then(() => dispatch(loadList(user, coll, list)))
        .then(() => dispatch(getBookmarkCount(user, coll, list)));
    },
    saveBookmarkSort: (list, ids) => {
      dispatch(bookmarkSort(user, coll, list, ids));
    },
    dispatch
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps,
  mapDispatchToProps
)(CollectionDetail);
