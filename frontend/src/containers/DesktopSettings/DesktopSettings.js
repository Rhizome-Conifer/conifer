import React from 'react';
import { asyncConnect } from 'redux-connect';

import { load as loadAuth } from 'store/modules/auth';
import { load as loadUser, updateUser } from 'store/modules/user';

import DesktopSettingsUI from 'components/siteComponents/DesktopSettingsUI';


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
    deleting: app.getIn(['auth', 'deleting']),
    deleteError: app.getIn(['auth', 'deleteError']),
    user: app.get('user')
  };
};

const mapDispatchToProps = (dispatch, props) => {
  return {};
};

export default asyncConnect(
  preloadData,
  mapStateToProps,
  mapDispatchToProps
)(DesktopSettingsUI);
