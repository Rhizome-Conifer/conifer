import React from 'react';
import { connect } from 'react-redux';

import { addUserCollection, incrementCollCount, loadCollections, selectCollection } from 'store/modules/auth';
import { createCollection } from 'store/modules/collections';

import { getActiveCollection, sortUserCollsByAlpha, sortUserCollsByUpdateAt } from 'store/selectors';

import CollectionDropdownUI from 'components/collection/CollectionDropdownUI';


const mapStateToProps = ({ app }) => {
  const mostRecent = sortUserCollsByUpdateAt(app);
  return {
    activeCollection: getActiveCollection(app),
    auth: app.get('auth'),
    collections: sortUserCollsByAlpha(app),
    mostRecent: mostRecent ? mostRecent.getIn([0, 'id']) : '',
    creatingCollection: app.getIn(['collections', 'creatingCollection']),
    collectionError: app.getIn(['collections', 'error']),
    loading: app.getIn(['auth', 'loading']),
    newCollection: app.getIn(['collections', 'newCollection']),
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
