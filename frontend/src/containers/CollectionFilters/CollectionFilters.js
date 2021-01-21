import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { clearSearch, load, loadMetadata, search } from 'store/modules/collection';

import CollectionFiltersUI from 'components/collection/CollectionFiltersUI';


const mapStateToProps = ({ app }) => {
  return {
    user: app.getIn(['auth', 'user']),
    collection: app.get('collection'),
    indexing: app.getIn(['collection', 'indexing']),
    searching: app.getIn(['collection', 'searching']),
    searched: app.getIn(['collection', 'searched'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    loadMeta: (user, coll) => dispatch(loadMetadata(user, coll)),
    searchCollection: (user, coll, params, fullText) => dispatch(search(user, coll, params, fullText)),
    clearSearch: async (user, coll) => {
      await dispatch(clearSearch());
      await dispatch(load(user, coll));
    },
    dispatch
  };
};

export default withRouter(connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionFiltersUI));
