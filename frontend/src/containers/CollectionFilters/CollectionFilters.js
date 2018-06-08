import React from 'react';
import { connect } from 'react-redux';
import { createSearchAction } from 'redux-search';

import { setQueryMode } from 'store/modules/pageQuery';

import { getSearchText } from 'store/selectors/search';

import CollectionFiltersUI from 'components/collection/CollectionFiltersUI';


const mapStateToProps = (outerState) => {
  const { app } = outerState;
  const searchKey = outerState.search['collection.pages'];
  const isIndexing = searchKey.isSearching && searchKey.text === '';

  return {
    collection: app.get('collection'),
    isIndexing,
    querying: app.getIn(['pageQuery', 'querying']),
    searchText: getSearchText(outerState)
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    searchPages: createSearchAction('collection.pages'),
    setPageQuery: coll => dispatch(setQueryMode(true, coll)),
    dispatch
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionFiltersUI);
