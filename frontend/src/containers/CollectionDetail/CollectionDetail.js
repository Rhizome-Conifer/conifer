import React, { Component } from 'react';
import PropTypes from 'prop-types';
import querystring from 'querystring';
import { asyncConnect } from 'redux-connect';
import { Map } from 'immutable';

import { isLoaded as isCollLoaded, load as loadColl } from 'redux/modules/collection';
import { clear, multiSelect, selectBookmark, selectPage } from 'redux/modules/inspector';
import { load as loadList, removeBookmark, bookmarkSort } from 'redux/modules/list';
import { setQueryMode } from 'redux/modules/pageQuery';
import { isLoaded as isRBLoaded, load as loadRB } from 'redux/modules/remoteBrowsers';
import { getQueryPages, getOrderedPages, pageSearchResults } from 'redux/selectors';

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
        return dispatch(loadColl(user, coll));
      }

      return undefined;
    }
  },
  {
    promise: ({ match: { params: { coll, list, user } }, store: { dispatch } }) => {
      if (list) {
        return dispatch(loadList(user, coll, list));
      }

      return undefined;
    }
  },
  {
    promise: ({ store: { dispatch, getState } }) => {
      if(!isRBLoaded(getState())) {
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
    collection: app.get('collection'),
    browsers: app.get('remoteBrowsers'),
    loaded: reduxAsyncConnect.loaded,
    pages,
    publicIndex: app.getIn(['collection', 'public_index']),
    list: app.get('list')
  };
};

const mapDispatchToProps = (dispatch, { match: { params: { user, coll } } }) => {
  return {
    clearInspector: () => dispatch(clear()),
    clearQuery: () => dispatch(setQueryMode(false)),
    setMultiInspector: count => dispatch(multiSelect(count)),
    setPageInspector: fields => dispatch(selectPage(fields)),
    setBookmarkInspector: bk => dispatch(selectBookmark(bk)),
    removeBookmark: (list, id) => {
      dispatch(removeBookmark(user, coll, list, id))
        .then(() => dispatch(loadList(user, coll, list)));
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
