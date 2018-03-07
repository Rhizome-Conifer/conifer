import React from 'react';
import { connect } from 'react-redux';
import { createSearchAction } from 'redux-search';

import { toggleSidebarResize } from 'redux/modules/sidebar';
import { getActivePage, getOrderedPages,
         tsOrderedPageSearchResults } from 'redux/selectors';

import { SidebarUI } from 'components/controls';


const mapStateToProps = (outerState) => {
  const { app } = outerState;
  const { pageFeed, searchText } = tsOrderedPageSearchResults(outerState);
  const isIndexing = !pageFeed.size && app.getIn(['collection', 'pages']).size && !searchText;

  return {
    activePage: getActivePage(outerState),
    pages: isIndexing ? getOrderedPages(app) : pageFeed,
    collection: app.get('collection'),
    searchText,
    resizing: app.getIn(['sidebar', 'resizing'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    searchPages: createSearchAction('collection.pages'),
    sidebarResize: bool => dispatch(toggleSidebarResize(bool)),
    dispatch
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SidebarUI);
