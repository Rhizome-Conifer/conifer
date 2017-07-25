import { combineReducers } from 'redux';
import { routerReducer } from 'react-router-redux';
import { reducer as reduxAsyncConnect } from 'redux-connect';

import auth, { LOGIN_SUCCESS, LOGOUT_SUCCESS } from './auth';
import user from './user';
import collection from './collection';
import collections from './collections';
import recordings from './recordings';
import remoteBrowsers from './remoteBrowsers';

const appReducer = combineReducers({
  routing: routerReducer,
  reduxAsyncConnect,
  auth,
  collection,
  collections,
  recordings,
  remoteBrowsers,
  user
});

export default (state, action) => {
  // wipe state after logout, or partially after login
  switch(action.type) {
    case LOGOUT_SUCCESS: {
      const { routing, reduxAsyncConnectInstance } = state;
      const stateMod = { routing, reduxAsyncConnectInstance };
      return appReducer(stateMod, action);
    }
    case LOGIN_SUCCESS: {
      // delete any login errors if they exist
      const { authInstance, routing, reduxAsyncConnectInstance } = state;
      delete authInstance.loginError;
      const stateMod = { routing, authInstance, reduxAsyncConnectInstance };
      return appReducer(stateMod, action);
    }
    default:
      return appReducer(state, action);
  }
};
