import React from 'react';
import { asyncConnect } from 'redux-connect';

import { deleteUser, load as loadAuth, loadRoles, updatePassword } from 'store/modules/auth';
import { load as loadCollections } from 'store/modules/collections';
import { indexCollection as indexColl } from 'store/modules/collection';
import { edit, load as loadUser, resetEditState, updateUser } from 'store/modules/user';

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
  },
  {
    promise: ({ match: { params: { user } }, store: { dispatch } }) => {
      return dispatch(loadCollections(user));
    }
  }
];

const mapStateToProps = ({ app }) => {
  return {
    auth: app.get('auth'),
    collections: app.getIn(['collections', 'collections']),
    deleting: app.getIn(['auth', 'deleting']),
    deleteError: app.getIn(['auth', 'deleteError']),
    edited: app.getIn(['user', 'edited']),
    editing: app.getIn(['user', 'editing']),
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
    adminUpdateUser: (user, data) => dispatch(updateUser(user, data)),
    indexCollection: (user, coll, existing) => dispatch(indexColl(user, coll, existing)),
    editUser: (user, data) => {
      dispatch(edit(user, data))
        .then(() => setTimeout(() => dispatch(resetEditState()), 5000))
        .then(() => dispatch(loadUser(user, false)));
    }
  };
};

export default asyncConnect(
  preloadData,
  mapStateToProps,
  mapDispatchToProps
)(UserSettingsUI);
