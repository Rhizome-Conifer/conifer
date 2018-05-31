import React from 'react';
import { connect } from 'react-redux';

import { incrementCollCount } from 'redux/modules/auth';
import { createCollection } from 'redux/modules/collections';
import { addUserCollection, loadCollections, selectCollection } from 'redux/modules/user';

import { getActiveCollection, sortCollsByAlpha, sortCollsByUpdateAt } from 'redux/selectors';

import CollectionDropdownUI from 'components/collection/CollectionDropdownUI';


const mapStateToProps = ({ app }) => {
  return {
    activeCollection: getActiveCollection(app),
    collections: sortCollsByAlpha(app),
    mostRecent: sortCollsByUpdateAt(app).getIn([0, 'id']),
    creatingCollection: app.getIn(['collections', 'creatingCollection']),
    collectionError: app.getIn(['collections', 'error']),
    loading: app.getIn(['user', 'loading']),
    newCollection: app.getIn(['collections', 'newCollection']),
    user: app.getIn(['auth', 'user'])
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createNewCollection: (user, collTitle, makePublic) => {
      dispatch(createCollection(user, collTitle, makePublic))
        .then((res) => {
          if (res.hasOwnProperty('collection')) {
            dispatch(incrementCollCount(1));
            dispatch(addUserCollection(res.collection));
          }
        }, () => {});
    },
    setCollection: coll => dispatch(selectCollection(coll)),
    loadUserCollections: username => dispatch(loadCollections(username))
  };
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(CollectionDropdownUI);
