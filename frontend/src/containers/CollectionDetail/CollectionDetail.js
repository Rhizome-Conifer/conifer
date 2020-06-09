import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import { isLoaded as isCollLoaded, getBookmarkCount, load as loadColl, search } from 'store/modules/collection';
import { clear, multiSelect, selectBookmark, selectPage } from 'store/modules/inspector';
import { load as loadList, removeBookmark, bookmarkSort } from 'store/modules/list';
import { isLoaded as isRBLoaded, load as loadRB } from 'store/modules/remoteBrowsers';
import { AccessContext } from 'store/contexts';

import { getOrderedBookmarks, getOrderedPages } from 'store/selectors';

import CollectionDetailUI from 'components/collection/CollectionDetailUI';


class CollectionDetail extends Component {
  static propTypes = {
    auth: PropTypes.object,
    collection: PropTypes.object,
    match: PropTypes.object
  };

  render() {
    const { auth, match: { params: { user } } } = this.props;

    const contextValues = {
      canAdmin: auth.getIn(['user', 'username']) === user
    };

    return (
      <AccessContext.Provider value={contextValues}>
        <CollectionDetailUI {...this.props} />
      </AccessContext.Provider>
    );
  }
}


const initialData = [
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

      if (!isRBLoaded(state) && !__DESKTOP__) {
        return dispatch(loadRB());
      }

      return undefined;
    }
  }
];

const mapStateToProps = (outerState) => {
  const { app, reduxAsyncConnect } = outerState;
  const pages = getOrderedPages(app);
  const bookmarks = getOrderedBookmarks(app);

  return {
    auth: app.get('auth'),
    bookmarks,
    browsers: app.get('remoteBrowsers'),
    bkDeleting: app.getIn(['list', 'bkDeleting']),
    bkDeleteError: app.getIn(['list', 'bkDeleteError']),
    collection: app.get('collection'),
    list: app.get('list'),
    loaded: reduxAsyncConnect.loaded,
    pages,
    publicIndex: app.getIn(['collection', 'public_index']),
    searched: app.getIn(['collection', 'searched'])
  };
};

const mapDispatchToProps = (dispatch, { match: { params: { user, coll } } }) => {
  return {
    clearInspector: () => dispatch(clear()),
    clearSearch: () => dispatch(search(user, coll, { mime: 'text/html', search: '*' })),
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
