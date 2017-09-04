import React from 'react';
import { asyncConnect } from 'redux-connect';
import { push } from 'react-router-redux';

import { isLoaded as isAuthLoaded } from 'redux/modules/auth';
import { load as loadUser,
         isLoaded as isUserLoaded,
         updatePassword,
         deleteUser } from 'redux/modules/user';

import { UserSettingsUI } from 'components/siteComponents';


const preloadData = [
  {
    promise: ({ store: { dispatch, getState } }) => {
      const state = getState();

      if(isAuthLoaded(state) && !isUserLoaded(state))
        return dispatch(loadUser(state.getIn(['auth', 'user', 'username'])));

      return undefined;
    }
  }
];

const mapStateToProps = (state) => {
  return {
    user: state.get('user')
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    updatePass: (currPass, newPass, newPass2) => dispatch(updatePassword(currPass, newPass, newPass2)),
    deleteUser: (user) => {
      return dispatch(deleteUser(user)).then(dispatch(push('/')));
    }
  };
};

export default asyncConnect(
  preloadData,
  mapStateToProps,
  mapDispatchToProps
)(UserSettingsUI);
