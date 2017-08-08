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

const initialState = {
  loaded: false
};

const defaultUser = {
  username: null,
  role: null
};

export default function auth(state = initialState, action = {}) {
  switch (action.type) {
    case LOAD:
      return {
        ...state,
        loading: true
      };
    case LOAD_SUCCESS:
      return {
        ...state,
        loading: false,
        loaded: true,
        user: action.result
      };
    case LOAD_FAIL:
      return {
        ...state,
        loading: false,
        loaded: false,
        error: action.error
      };
    case LOGIN:
      return {
        ...state,
        loggingIn: true
      };
    case LOGIN_SUCCESS:
      return {
        ...state,
        loggingIn: false,
        user: action.result
      };
    case LOGIN_FAIL:
      return {
        ...state,
        loggingIn: false,
        user: defaultUser,
        loginError: action.error
      };
    case LOGOUT:
      return {
        ...state,
        loggingOut: true
      };
    case LOGOUT_SUCCESS:
      return {
        ...state,
        loggingOut: false,
        user: defaultUser
      };
    case LOGOUT_FAIL:
      return {
        ...state,
        loggingOut: false,
        logoutError: action.error
      };
    default:
      return state;
  }
}

export function isLoaded(globalState) {
  return globalState.auth && globalState.auth.loaded;
}

export function load() {
  return {
    types: [LOAD, LOAD_SUCCESS, LOAD_FAIL],
    promise: client => client.get(`${config.apiPath}/load_auth`)
  };
}

export function login(postData) {
  return {
    types: [LOGIN, LOGIN_SUCCESS, LOGIN_FAIL],
    promise: client => client.post(`${config.apiPath}/login`, {
      data: {
        ...postData
      }
    })
  };
}

export function logout() {
  return {
    types: [LOGOUT, LOGOUT_SUCCESS, LOGOUT_FAIL],
    promise: client => client.get(`${config.apiPath}/logout`)
  };
}
