import React from 'react';
import { asyncConnect } from 'redux-connect';

import { isLoaded as areCollsLoaded,
         load as loadCollections,
         createCollection } from 'redux/modules/collections';
import { sortCollsByCreatedAt } from 'redux/selectors';

import { CollectionListUI } from 'components/siteComponents';


const preloadCollections = [
  {
    promise: ({ params, store: { dispatch, getState } }) => {
      const state = getState();
      const collections = state.get('collections');
      const { user } = params;

      if(!areCollsLoaded(state) || (collections.get('user') === user &&
         Date.now() - collections.get('accessed') > 15 * 60 * 1000)) {
        return dispatch(loadCollections(user));
      }

      return undefined;
    }
  }
];

const mapStateToProps = (state) => {
  return {
    auth: state.get('auth'),
    collections: state.get('collections'),
    orderedCollections: sortCollsByCreatedAt(state),
    user: state.get('user')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    createNewCollection: (user, collTitle, makePublic) => dispatch(createCollection(user, collTitle, makePublic))
  };
};

export default asyncConnect(
  preloadCollections,
  mapStateToProps,
  mapDispatchToProps
)(CollectionListUI);
