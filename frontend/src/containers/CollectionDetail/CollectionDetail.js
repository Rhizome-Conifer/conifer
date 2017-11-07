import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';
import { BreadcrumbsItem } from 'react-breadcrumbs-dynamic';
import { createSearchAction } from 'redux-search';

import { truncate } from 'helpers/utils';
import { load as loadColl } from 'redux/modules/collection';
import { isLoaded as isRBLoaded, load as loadRB } from 'redux/modules/remoteBrowsers';
import { getOrderedBookmarks, getOrderedRecordings, bookmarkSearchResults } from 'redux/selectors';

import CollectionDetailUI from 'components/CollectionDetailUI';


class CollectionDetail extends Component {

    // TODO move to HOC
  static childContextTypes = {
    canAdmin: PropTypes.bool,
    canWrite: PropTypes.bool
  };

  getChildContext() {
    const { auth, params: { user } } = this.props;
    const username = auth.getIn(['user', 'username']);

    return {
      canAdmin: username === user,
      canWrite: username === user //&& !auth.anon
    };
  }

  render() {
    const { collection, params: { user, coll } } = this.props;

    return [
      <BreadcrumbsItem key="a" to={`/${user}`}>{ user }</BreadcrumbsItem>,
      <BreadcrumbsItem key="b" to={`/${user}/${coll}`}>{ truncate(collection.get('title'), 60) }</BreadcrumbsItem>,
      <CollectionDetailUI key="c" {...this.props} />
    ];
  }
}


const initialData = [
  {
    promise: ({ params, store: { dispatch } }) => {
      const { user, coll } = params;

      return dispatch(loadColl(user, coll));
    }
  },
  {
    promise: ({ store: { dispatch, getState } }) => {
      if(!isRBLoaded(getState()))
        return dispatch(loadRB());

      return undefined;
    }
  }
];

const mapStateToProps = (outerState) => {
  const { app } = outerState;
  const { bookmarkFeed, searchText } = bookmarkSearchResults(outerState);
  const isIndexing = !bookmarkFeed.size && app.getIn(['collection', 'bookmarks']).size && !searchText;

  return {
    auth: app.get('auth'),
    collection: app.get('collection'),
    browsers: app.get('remoteBrowsers'),
    recordings: getOrderedRecordings(app),
    bookmarks: isIndexing ? getOrderedBookmarks(app) : bookmarkFeed,
    searchText
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    searchBookmarks: createSearchAction('bookmarks'),
    dispatch
  };
};

export default asyncConnect(
  initialData,
  mapStateToProps,
  mapDispatchToProps
)(CollectionDetail);
