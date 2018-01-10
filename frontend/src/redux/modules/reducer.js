import { combineReducers } from 'redux';
import { combineReducers as combineImmutableReduers } from 'redux-immutable';
import { Map } from 'immutable';
import { reducer as reduxAsyncConnect } from 'redux-connect';
import { reducer as searchReducer } from 'redux-search';

import { auth, LOGIN_SUCCESS, LOGOUT_SUCCESS } from './auth';
import routerReducer from './routerReducer';

import bugReport from './bugReport';
import collection from './collection';
import collections from './collections';
import controls from './controls';
import infoStats from './infoStats';
import passwordReset from './passwordReset';
import remoteBrowsers from './remoteBrowsers';
import sidebar from './sidebar';
import sizeCounter from './sizeCounter';
import toolBin from './toolBin';
import user from './user';
import userSignup from './userSignup';

const makeAppReducer = () => combineImmutableReduers({
  routing: routerReducer,
  auth,
  bugReport,
  collection,
  collections,
  controls,
  passwordReset,
  remoteBrowsers,
  sidebar,
  sizeCounter,
  infoStats,
  toolBin,
  user,
  userSignup
});

const appReducer = combineReducers({
  search: searchReducer,
  reduxAsyncConnect,
  app: makeAppReducer()
});

export default (state, action) => {
  // wipe state after logout, or partially after login
  switch(action.type) {
    case LOGOUT_SUCCESS: {
      const { reduxAsyncConnect, app: { auth, routing } } = state;
      const stateMod = { reduxAsyncConnect, app: Map({ auth, routing }) };
      return appReducer(stateMod, action);
    }
    // case LOGIN_SUCCESS: {
    //   // delete any login errors if they exist

    //   const stateMod = state.setIn(['auth', ])
    //   return appReducer(stateMod, action);
    // }
    default:
      return appReducer(state, action);
  }
};
