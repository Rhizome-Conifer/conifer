import { combineReducers } from 'redux';
import { combineReducers as combineImmutableReduers } from 'redux-immutable';
import { reducer as reduxAsyncConnect } from 'redux-connect';
import { reducer as searchReducer } from 'redux-search';

import { auth, LOGIN_SUCCESS, LOGOUT_SUCCESS } from './modules/auth';

import appSettings from './modules/appSettings';
import bugReport from './modules/bugReport';
import collection from './modules/collection';
import collections from './modules/collections';
import controls from './modules/controls';
import infoStats from './modules/infoStats';
import inspector from './modules/inspector';
import list from './modules/list';
import passwordReset from './modules/passwordReset';
import pageQuery from './modules/pageQuery';
import recordings from './modules/recordings';
import remoteBrowsers from './modules/remoteBrowsers';
import sidebar from './modules/sidebar';
import toolBin from './modules/toolBin';
import user from './modules/user';
import userLogin from './modules/userLogin';
import userSignup from './modules/userSignup';


const makeAppReducer = () => {
  const reducers = {
    auth,
    bugReport,
    collection,
    collections,
    controls,
    infoStats,
    inspector,
    list,
    pageQuery,
    passwordReset,
    recordings,
    remoteBrowsers,
    sidebar,
    toolBin,
    user,
    userLogin,
    userSignup
  };

  if (__PLAYER__) {
    reducers.appSettings = appSettings;
  }

  return combineImmutableReduers(reducers);
};


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
      state.app = undefined;
      return appReducer(state, action);
    }
    default:
      return appReducer(state, action);
  }
};
