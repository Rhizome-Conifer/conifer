import React from 'react';
import { asyncConnect } from 'redux-connect';

import { isLoaded as isCollLoaded, load as loadColl } from 'redux/modules/collection';

import CollectionCoverUI from 'components/collection/CollectionCoverUI';


const initialData = [
  {
    promise: ({ match: { params: { coll, user } }, store: { dispatch, getState } }) => {
      const state = getState();

      // if switching to list view, prevent reloading collection
      if ((!isCollLoaded(state) || state.app.getIn(['collection', 'id']) !== coll)) {
        return dispatch(loadColl(user, coll));
      }

      return undefined;
    }
  },
];


const mapStateToProps = ({ app }) => {
  return {
    collection: app.get('collection')
  };
};


export default asyncConnect(
  initialData,
  mapStateToProps
)(CollectionCoverUI);
