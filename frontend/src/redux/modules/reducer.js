import { combineReducers } from 'redux';
import { combineReducers as combineImmutableReduers } from 'redux-immutable';
import { Map } from 'immutable';
import { reducer as reduxAsyncConnect } from 'redux-connect';
import { reducer as searchReducer } from 'redux-search';

import { auth, LOGIN_SUCCESS, LOGOUT_SUCCESS } from './auth';

import bugReport from './bugReport';
import collection from './collection';
import collections from './collections';
import controls from './controls';
import infoStats from './infoStats';
import passwordReset from './passwordReset';
import recordings from './recordings';
import remoteBrowsers from './remoteBrowsers';
import sidebar from './sidebar';
import sizeCounter from './sizeCounter';
import tempUser from './tempUser';
import toolBin from './toolBin';
import user from './user';
import userLogin from './userLogin';
import userSignup from './userSignup';


const makeAppReducer = () => combineImmutableReduers({
  auth,
  bugReport,
  collection,
  collections,
  controls,
  infoStats,
  passwordReset,
  recordings,
  remoteBrowsers,
  sidebar,
  sizeCounter,
  tempUser,
  toolBin,
  user,
  userLogin,
  userSignup
});

const appReducer = combineReducers({
  search: searchReducer,
  reduxAsyncConnect,
  app: makeAppReducer()
});

export default (state, action) => {
  // wipe app state after login & logout
  switch(action.type) {
    case LOGOUT_SUCCESS: {
      state.app = undefined;
      return appReducer(state, action);
    }
    case LOGIN_SUCCESS: {
      // delete any login errors if they exist
      state.app = undefined;
      return appReducer(state, action);
    }
    default:
      return appReducer(state, action);
  }
};
