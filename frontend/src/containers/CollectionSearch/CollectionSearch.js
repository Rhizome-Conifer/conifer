import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { asyncConnect } from 'redux-connect';

import { load as loadColl } from 'store/modules/collection';
import { isLoaded as isRBLoaded, load as loadRB } from 'store/modules/remoteBrowsers';

import CollectionSearchUI from 'components/collection/CollectionSearchUI';


const initialData = [
  {
    promise: ({ match: { params: { coll, user } }, store: { dispatch} }) => {
      return dispatch(loadColl(user, coll));
    }
  },
  {
    promise: ({ store: { dispatch, getState } }) => {
      const state = getState();

      if (!isRBLoaded(state) && !__DESKTOP__) {
        return dispatch(loadRB());
      }

      return undefined;
    }
  }
];


const mapStateToProps = (outerState) => {
  return {
  };
};


export default asyncConnect(
  initialData,
  mapStateToProps
)(CollectionSearchUI);
