import React from 'react';
import { connect } from 'react-redux';

import { createCollection } from 'redux/modules/collections';
import { load as loadUser, selectCollection } from 'redux/modules/user';
import { getActiveCollection } from 'redux/selectors';
import CollectionDropdownUI from 'components/CollectionDropdownUI';


const mapStateToProps = (state) => {
  return {
    activeCollection: getActiveCollection(state),
    collections: state.getIn(['user', 'collections']),
    creatingCollection: state.getIn(['collections', 'creatingCollection']),
    newCollection: state.getIn(['collections', 'newCollection']),
    user: state.getIn(['auth', 'user'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createNewCollection: (user, collTitle, makePublic) => dispatch(createCollection(user, collTitle, makePublic)),
    setCollection: coll => dispatch(selectCollection(coll)),
    loadUser: username => dispatch(loadUser(username))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionDropdownUI);
