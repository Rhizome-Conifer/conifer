import React from 'react';
import { connect } from 'react-redux';
import { createSearchAction } from 'redux-search';

import { bulkAddTo } from 'redux/modules/list';
import { setQueryMode } from 'redux/modules/pageQuery';

import { getSearchText } from 'redux/selectors/search';

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
    addPagesToLists: (user, coll, pages, lists) => {
      const bookmarkPromises = [];
      for (const list of lists) {
        dispatch(bulkAddTo(user, coll, list, pages));
      }

      return Promise.all(bookmarkPromises);
    },
    searchPages: createSearchAction('collection.pages'),
    setPageQuery: coll => dispatch(setQueryMode(true, coll)),
    dispatch
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionFiltersUI);
