import { combineReducers } from 'redux';
import { routerReducer } from 'react-router-redux';
import { reducer as reduxAsyncConnect } from 'redux-connect';

import { auth, LOGIN_SUCCESS, LOGOUT_SUCCESS } from './auth';
import bugReport from './bugReport';
import collection from './collection';
import collections from './collections';
import passwordReset from './passwordReset';
import recordings from './recordings';
import remoteBrowsers from './remoteBrowsers';
import user from './user';
import userSignup from './userSignup';


const appReducer = combineReducers({
  routing: routerReducer,
  reduxAsyncConnect,
  auth,
  bugReport,
  collection,
  collections,
  passwordReset,
  recordings,
  remoteBrowsers,
  user,
  userSignup
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
      const { auth, routing, reduxAsyncConnectInstance } = state;
      delete auth.loginError;
      const stateMod = { routing, auth, reduxAsyncConnectInstance };
      return appReducer(stateMod, action);
    }
    default:
      return appReducer(state, action);
  }
};
