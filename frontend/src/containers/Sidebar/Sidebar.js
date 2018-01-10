import React from 'react';
import { connect } from 'react-redux';
import { createSearchAction } from 'redux-search';

import { toggleSidebarResize } from 'redux/modules/sidebar';
import { getActiveBookmark, getOrderedBookmarks,
         timestampOrderedBookmarkSearchResults } from 'redux/selectors';

import { SidebarUI } from 'components/controls';


const mapStateToProps = (outerState) => {
  const { app } = outerState;
  const { bookmarkFeed, searchText } = timestampOrderedBookmarkSearchResults(outerState);
  const isIndexing = !bookmarkFeed.size && app.getIn(['collection', 'bookmarks']).size && !searchText;

  return {
    activeBookmark: getActiveBookmark(outerState),
    bookmarks: isIndexing ? getOrderedBookmarks(app) : bookmarkFeed,
    collection: app.get('collection'),
    searchText
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    searchBookmarks: createSearchAction('bookmarks'),
    sidebarResize: bool => dispatch(toggleSidebarResize(bool)),
    dispatch
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SidebarUI);
