import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';

import { clearSearch, load, search } from 'store/modules/collection';

import CollectionFiltersUI from 'components/collection/CollectionFiltersUI';


const mapStateToProps = ({ app }) => {
  return {
    collection: app.get('collection'),
    searching: app.getIn(['collection', 'searching']),
    searched: app.getIn(['collection', 'searched'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
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
