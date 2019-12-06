import React from 'react';
import { connect } from 'react-redux';

import { search } from 'store/modules/collection';
import { getOrderedPages } from 'store/selectors';


import AdvancedSearchUI from 'components/AdvancedSearchUI';


const mapStateToProps = ({ app }) => {
  return {
    browsers: app.get('remoteBrowsers'),
    collection: app.get('collection'),
    pages: getOrderedPages(app)
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    searchCollection: (user, coll, params) => dispatch(search(user, coll, params))
  };
};


export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AdvancedSearchUI);
