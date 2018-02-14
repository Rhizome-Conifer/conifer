import React from 'react';
import { asyncConnect } from 'redux-connect';

import { isLoaded as areCollsLoaded,
         load as loadCollections,
         createCollection } from 'redux/modules/collections';
import { sortCollsByCreatedAt } from 'redux/selectors';

import CollectionListUI from 'components/CollectionListUI';


const preloadCollections = [
  {
    promise: ({ match: { params }, store: { dispatch, getState } }) => {
      const state = getState();
      const collections = state.app.get('collections');
      const { user } = params;

      if(!areCollsLoaded(state) || (collections.get('user') === user &&
         Date.now() - collections.get('accessed') > 15 * 60 * 1000)) {
        return dispatch(loadCollections(user));
      }

      return undefined;
    }
  }
];

const mapStateToProps = ({ app }) => {
  return {
    auth: app.get('auth'),
    collections: app.get('collections'),
    orderedCollections: app.getIn(['collections', 'loaded']) ? sortCollsByCreatedAt(app) : null,
    user: app.get('user')
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
