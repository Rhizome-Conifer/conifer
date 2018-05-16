import React from 'react';
import { connect } from 'react-redux';
import { createSearchAction } from 'redux-search';

import { clear, selectPage } from 'redux/modules/inspector';
import { getActivePageIdx, getOrderedPages,
         timestampOrderedIds, tsOrderedPageSearchResults } from 'redux/selectors';

import { SidebarPageViewerUI } from 'components/controls';


const mapStateToProps = (outerState) => {
  const { app } = outerState;
  const { pageFeed, searchText } = tsOrderedPageSearchResults(outerState);
  const isIndexing = !pageFeed.size && app.getIn(['collection', 'pages']).size && !searchText;

  return {
    activePage: getActivePageIdx(outerState),
    pages: isIndexing ? getOrderedPages(app) : pageFeed,
    collection: app.get('collection'),
    orderedIds: timestampOrderedIds(app),
    searchText
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    searchPages: createSearchAction('collection.pages'),
    setInspector: pg => dispatch(selectPage(pg)),
    dispatch
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(SidebarPageViewerUI);
