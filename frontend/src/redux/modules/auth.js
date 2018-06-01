import { fromJS } from 'immutable';
import config from 'config';

const LOAD = 'wr/auth/LOAD';
const LOAD_SUCCESS = 'wr/auth/LOAD_SUCCESS';
const LOAD_FAIL = 'wr/auth/LOAD_FAIL';
const LOGIN = 'wr/auth/LOGIN';
export const LOGIN_SUCCESS = 'wr/auth/LOGIN_SUCCESS';
const LOGIN_FAIL = 'wr/auth/LOGIN_FAIL';
const LOGOUT = 'wr/auth/LOGOUT';
export const LOGOUT_SUCCESS = 'wr/auth/LOGOUT_SUCCESS';
const LOGOUT_FAIL = 'wr/auth/LOGOUT_FAIL';
const INCR_COLL_COUNT = 'wr/auth/INCR_COLL_COUNT';


const defaultUser = fromJS({
  username: null,
  role: null,
  anon: null,
  coll_count: 0
});

const initialState = fromJS({
  loaded: false,
  user: defaultUser
});

export function auth(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD:
      return state.set('loading', true);
    case LOAD_SUCCESS:
      return state.merge({
        loading: false,
        loaded: true,
        user: action.result
      });
    case LOAD_FAIL:
      return state.merge({
        loading: false,
        loaded: false,
        error: action.error
      });
    case LOGIN:
      return state.set('loggingIn', true);
    case LOGIN_SUCCESS:
      return state.merge({
        loggingIn: false,
        user: action.result,
        loginError: null,
      });
    case LOGIN_FAIL:
      return state.merge({
        loggingIn: false,
        loginError: action.error.error
      });
    case LOGOUT:
      return state.set('loggingOut', true);
    case LOGOUT_SUCCESS:
      return state.merge({
        loggingOut: false,
        user: defaultUser
      });
    case LOGOUT_FAIL:
      return state.merge({
        loggingOut: false,
        logoutError: action.error
      });
    case INCR_COLL_COUNT:
      return state.setIn(['user', 'coll_count'], state.getIn(['user', 'coll_count']) + action.incr);
    default:
      return state;
  }
}

export function isLoaded({ app }) {
  if (app.getIn(['auth', 'user', 'anon']) === true) {
    return app.getIn(['auth', 'user', 'coll_count']);
  }

  return app.get('auth') && app.getIn(['auth', 'loaded']);
}

export function load() {
  return {
    types: [LOAD, LOAD_SUCCESS, LOAD_FAIL],
    promise: client => client.get(`${config.apiPath}/auth`)
  };
}

export function login(postData) {
  return {
    types: [LOGIN, LOGIN_SUCCESS, LOGIN_FAIL],
    promise: client => client.post(`${config.apiPath}/auth/login`, {
      data: {
        ...postData
      }
    })
  };
}

export function incrementCollCount(incr) {
  return {
    type: INCR_COLL_COUNT,
    incr: incr || 0
  };
}

export function logout() {
  return {
    types: [LOGOUT, LOGOUT_SUCCESS, LOGOUT_FAIL],
    promise: client => client.post(`${config.apiPath}/auth/logout`)
  };
}
