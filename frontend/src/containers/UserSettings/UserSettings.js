import React from 'react';
import { asyncConnect } from 'redux-connect';

import { deleteUser, load as loadAuth, loadRoles, updatePassword } from 'redux/modules/auth';
import { load as loadUser, updateUser } from 'redux/modules/user';

import { UserSettingsUI } from 'components/siteComponents';


const preloadData = [
  {
    promise: ({ store: { dispatch } }) => {
      return dispatch(loadAuth());
    }
  },
  {
    promise: ({ match: { params: { user } }, store: { dispatch } }) => {
      return dispatch(loadUser(user, false));
    }
  }
];

const mapStateToProps = ({ app }) => {
  return {
    auth: app.get('auth'),
    deleting: app.getIn(['auth', 'user', 'deleting']),
    deleteError: app.getIn(['auth', 'user', 'deleteError']),
    user: app.get('user')
  };
};

const mapDispatchToProps = (dispatch, props) => {
  return {
    deleteUser: (user) => {
      // TODO: add Tests
      return dispatch(deleteUser(user)).then(() => props.history.push('/_logout'));
    },
    loadUserRoles: () => dispatch(loadRoles()),
    updatePass: (currPass, newPass, newPass2) => dispatch(updatePassword(currPass, newPass, newPass2)),
    updateUser: (user, data) => dispatch(updateUser(user, data))
  };
};

export default asyncConnect(
  preloadData,
  mapStateToProps,
  mapDispatchToProps
)(UserSettingsUI);
