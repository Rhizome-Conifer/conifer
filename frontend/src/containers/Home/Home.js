import React, { PureComponent } from 'react';

import { asyncConnect } from 'redux-connect';

import { loadCollections } from 'store/modules/auth';
import { showModal } from 'store/modules/userLogin';

import { HomeUI } from 'components/siteComponents';


const initalData = [
  {
    promise: ({ store: { dispatch, getState } }) => {
      const { app } = getState();
      if (!app.getIn(['auth', 'user', 'anon'])) {
        return dispatch(loadCollections(app.getIn(['auth', 'user', 'username'])));
      }
    }
  }
];

const mapStateToProps = ({ app }) => {
  return {
    auth: app.get('auth')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    showModalCB: (b = true) => dispatch(showModal(b))
  };
};

export default asyncConnect(
  initalData,
  mapStateToProps,
  mapDispatchToProps
)(HomeUI);
