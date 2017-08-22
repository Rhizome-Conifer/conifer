import React from 'react';
import { connect } from 'react-redux';

import { selectCollection } from 'redux/modules/user';
import { getActiveCollection } from 'redux/selectors';
import CollectionDropdownUI from 'components/CollectionDropdownUI';


const mapStateToProps = (state) => {
  const user = state.get('user');
  const auth = state.get('auth');
  return {
    auth,
    collections: user.get('collections'),
    activeCollection: getActiveCollection(state)
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setCollection: coll => dispatch(selectCollection(coll))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionDropdownUI);
