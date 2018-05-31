import React from 'react';
import { asyncConnect } from 'redux-connect';
import { batchActions } from 'redux-batched-actions';

import { incrementCollCount } from 'redux/modules/auth';
import { isLoaded as areCollsLoaded, load as loadCollections,
         createCollection } from 'redux/modules/collections';
import { addUserCollection } from 'redux/modules/user';
import { sortCollsByCreatedAt } from 'redux/selectors';

import CollectionListUI from 'components/collection/CollectionListUI';


const preloadCollections = [
  {
    promise: ({ match: { params }, store: { dispatch, getState } }) => {
      const state = getState();
      const collections = state.app.get('collections');
      const { user } = params;

      // if (!areCollsLoaded(state) || collections.get('owner') !== user) {
      return dispatch(loadCollections(user));
      // }

      // return undefined;
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

const mapDispatchToProps = (dispatch, { history }) => {
  return {
    createNewCollection: (user, collTitle, makePublic) => {
      dispatch(createCollection(user, collTitle, makePublic))
        .then((res) => {
          if (res.hasOwnProperty('collection')) {
            dispatch(batchActions([
              incrementCollCount(1),
              addUserCollection(res.collection)
            ]));
            history.push(`/${user}/${res.collection.slug}/index`);
          }
        }, () => {});
    }
  };
};

export default asyncConnect(
  preloadCollections,
  mapStateToProps,
  mapDispatchToProps
)(CollectionListUI);
