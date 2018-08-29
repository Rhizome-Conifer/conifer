import React from 'react';
import { asyncConnect } from 'redux-connect';

import { deleteUser, load as loadUser, updatePassword, updateUser } from 'redux/modules/user';

import { UserSettingsUI } from 'components/siteComponents';


const preloadData = [
  {
    promise: ({ match: { params: { user } }, store: { dispatch } }) => {
      return dispatch(loadUser(user));
    }
  }
];

const mapStateToProps = ({ app }) => {
  return {
    auth: app.getIn(['auth', 'user']),
    deleting: app.getIn(['user', 'deleting']),
    deleteError: app.getIn(['user', 'deleteError']),
    user: app.get('user')
  };
};

const mapDispatchToProps = (dispatch, props) => {
  return {
    deleteUser: (user) => {
      // TODO: add Tests
      return dispatch(deleteUser(user)).then(() => props.history.push('/_logout'));
    },
    updatePass: (currPass, newPass, newPass2) => dispatch(updatePassword(currPass, newPass, newPass2)),
    updateUser: (user, data) => dispatch(updateUser(user, data))
  };
};

export default asyncConnect(
  preloadData,
  mapStateToProps,
  mapDispatchToProps
)(UserSettingsUI);
