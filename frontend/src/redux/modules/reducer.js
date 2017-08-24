import Immutable from 'immutable';
//import { combineReducers } from 'redux';
import { combineReducers } from 'redux-immutable';
//import { routerReducer } from 'react-router-redux';
//import { reducer as reduxAsyncConnect } from 'redux-connect';
import { setToImmutableStateFunc, setToMutableStateFunc,
         immutableReducer as immutableReduxAsyncConnect } from 'redux-connect';

import { auth, LOGIN_SUCCESS, LOGOUT_SUCCESS } from './auth';
import routerReducer from './routerReducer';

import bugReport from './bugReport';
import collection from './collection';
import collections from './collections';
import controls from './controls';
import passwordReset from './passwordReset';
//import recordings from './recordings';
import remoteBrowsers from './remoteBrowsers';
import toolBin from './toolBin';
import user from './user';
import userSignup from './userSignup';


// Set the mutability/immutability functions
setToImmutableStateFunc(mutableState => Immutable.fromJS(mutableState));
setToMutableStateFunc(immutableState => immutableState.toJS());

const appReducer = combineReducers({
  routing: routerReducer,
  reduxAsyncConnect: immutableReduxAsyncConnect,
  auth,
  bugReport,
  collection,
  collections,
  controls,
  passwordReset,
  // recordings,
  remoteBrowsers,
  toolBin,
  user,
  userSignup
});

export default (state, action) => {
  // wipe state after logout, or partially after login
  switch(action.type) {
    case LOGOUT_SUCCESS: {
      const { auth, routing, reduxAsyncConnect } = state;
      const stateMod = Immutable.Map({ auth, routing, reduxAsyncConnect });
      return appReducer(stateMod, action);
    }
    case LOGIN_SUCCESS: {
      // delete any login errors if they exist
      const { auth, routing, reduxAsyncConnect } = state;
      // auth.set('loginError', null);
      const stateMod = Immutable.Map({ routing, auth, reduxAsyncConnect });
      return appReducer(stateMod, action);
    }
    default:
      return appReducer(state, action);
  }
};
