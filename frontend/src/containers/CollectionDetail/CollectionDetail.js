import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';
import { createSearchAction } from 'redux-search';
import { Map } from 'immutable';

import { load as loadColl } from 'redux/modules/collection';
import { addTo, load as loadList, removeBookmark, saveSort } from 'redux/modules/list';
import { isLoaded as isRBLoaded, load as loadRB } from 'redux/modules/remoteBrowsers';
import { deleteRecording } from 'redux/modules/recordings';
import { getOrderedPages, getOrderedRecordings, pageSearchResults } from 'redux/selectors';

import CollectionDetailUI from 'components/CollectionDetailUI';


class CollectionDetail extends Component {

  static propTypes = {
    auth: PropTypes.object,
    collection: PropTypes.object,
    match: PropTypes.object
  };

    // TODO move to HOC
  static childContextTypes = {
    canAdmin: PropTypes.bool,
    canWrite: PropTypes.bool
  };

  getChildContext() {
    const { auth, match: { params: { user } } } = this.props;
    const username = auth.getIn(['user', 'username']);

    return {
      canAdmin: username === user,
      canWrite: username === user && !auth.anon
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
    promise: ({ match: { params }, store: { dispatch } }) => {
      const { user, coll } = params;

      return dispatch(loadColl(user, coll));
    }
  },
  {
    promise: ({ match: { params: { user, coll, list } }, store: { dispatch } }) => {
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

  return {
    auth: app.get('auth'),
    collection: app.get('collection'),
    browsers: app.get('remoteBrowsers'),
    loaded: reduxAsyncConnect.loaded,
    recordings: isLoaded ? getOrderedRecordings(app) : null,
    pages: isIndexing ? getOrderedPages(app) : pageFeed,
    searchText,
    list: app.get('list')
  };
};

const mapDispatchToProps = (dispatch, { history, match: { params: { user, coll } } }) => {
  return {
    addPagesToLists: (pages, lists) => {
      const bookmarkPromises = [];
      for (const list of lists) {
        for (const page of pages) {
          bookmarkPromises.push(dispatch(addTo(user, coll, list, page)));
        }
      }

      return Promise.all(bookmarkPromises);
    },
    deleteRec: (rec) => {
      dispatch(deleteRecording(user, coll, rec))
        .then((res) => {
          if (res.hasOwnProperty('deleted_id')) {
            dispatch(loadColl(user, coll));
          }
        }, () => { console.log('Rec delete error..'); });
    },
    removeBookmark: (list, id) => {
      dispatch(removeBookmark(user, coll, list, id))
        .then(() => dispatch(loadList(user, coll, list)));
    },
    saveBookmarkSort: (list, ids) => {
      dispatch(saveSort(user, coll, list, ids));
    },
    searchPages: createSearchAction('collection.pages'),
    dispatch
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps,
  mapDispatchToProps
)(CollectionDetail);
