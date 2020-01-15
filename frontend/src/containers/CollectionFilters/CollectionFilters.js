import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { clearSearch, load, search } from 'store/modules/collection';
import { setQueryMode } from 'store/modules/pageQuery';

import CollectionFiltersUI from 'components/collection/CollectionFiltersUI';


const mapStateToProps = ({ app }) => {
  return {
    collection: app.get('collection'),
    querying: app.getIn(['pageQuery', 'querying']),
    searching: app.getIn(['collection', 'searching']),
    searched: app.getIn(['collection', 'searched'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    searchCollection: (user, coll, params) => dispatch(search(user, coll, params)),
    clearSearch: async (user, coll) => {
      await dispatch(clearSearch());
      await dispatch(load(user, coll));
    },
    setPageQuery: coll => dispatch(setQueryMode(true, coll)),
    dispatch
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionFiltersUI));
