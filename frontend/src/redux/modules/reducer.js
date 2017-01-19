import { combineReducers } from 'redux';
import { routerReducer } from 'react-router-redux';
import { reducer as reduxAsyncConnect } from 'redux-connect';

import auth, { LOGIN_SUCCESS, LOGOUT_SUCCESS } from './auth';
import info from './info';

const appReducer = combineReducers({
  routing: routerReducer,
  reduxAsyncConnect,
  auth,
  info
});

export default (state, action) => {
  // wipe state after logout, or partially after login
  switch(action.type) {
    case LOGOUT_SUCCESS: {
      const { routing, reduxAsyncConnect } = state;
      const stateMod = { routing, reduxAsyncConnect };
      return appReducer(stateMod, action);
    }
    case LOGIN_SUCCESS: {
      // delete any login errors if they exist
      const { auth, routing, reduxAsyncConnect } = state;
      delete auth.loginError;
      const stateMod = { routing, auth, reduxAsyncConnect };
      return appReducer(stateMod, action);
    }
    default:
      return appReducer(state, action);
  }
};
