import React from 'react';
import { connect } from 'react-redux';

import { setQueryMode } from 'store/modules/pageQuery';

import CollectionFiltersUI from 'components/collection/CollectionFiltersUI';


const mapStateToProps = (outerState) => {
  const { app } = outerState;
  const searchKey = outerState.search['collection.pages'];
  const isIndexing = searchKey.isSearching && searchKey.text === '';

  return {
    collection: app.get('collection'),
    isIndexing,
    querying: app.getIn(['pageQuery', 'querying']),
    searchText: app.getIn(['collection', 'search']),
    searching: app.getIn(['collection', 'searching'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    searchPages: q => console.log(`searching ${q}`),
    setPageQuery: coll => dispatch(setQueryMode(true, coll)),
    dispatch
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionFiltersUI);
