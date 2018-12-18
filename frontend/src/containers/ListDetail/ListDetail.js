import React from 'react';
import { asyncConnect } from 'redux-connect';

import { isLoaded as isCollLoaded, load as loadColl } from 'store/modules/collection';
import { load as loadList } from 'store/modules/list';


import ListDetailUI from 'components/collection/ListDetailUI';

const initialData = [
  {
    promise: ({ match: { params: { coll, user, list } }, store: { dispatch, getState } }) => {
      const { app } = getState();
      let host = '';

      if (__PLAYER__) {
        host = app.getIn(['appSettings', 'host']);
      }

      return dispatch(loadColl(user, coll, host))
        .then(() => dispatch(loadList(user, coll, list, host)));
    }
  }
];


const mapStateToProps = ({ app }) => {

  return {
    auth: app.get('auth'),
    collection: app.get('collection'),
    list: app.get('list')
  };
};


export default asyncConnect(
  initialData,
  mapStateToProps
)(ListDetailUI);
