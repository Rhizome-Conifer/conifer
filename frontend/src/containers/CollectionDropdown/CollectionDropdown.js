import React from 'react';
import { connect } from 'react-redux';

import { createCollection } from 'redux/modules/collections';
import { load as loadUser, selectCollection } from 'redux/modules/user';
import { getActiveCollection } from 'redux/selectors';
import CollectionDropdownUI from 'components/CollectionDropdownUI';


const mapStateToProps = ({ app }) => {
  return {
    activeCollection: getActiveCollection(app),
    collections: app.getIn(['user', 'collections']),
    creatingCollection: app.getIn(['collections', 'creatingCollection']),
    newCollection: app.getIn(['collections', 'newCollection']),
    user: app.getIn(['auth', 'user'])
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
