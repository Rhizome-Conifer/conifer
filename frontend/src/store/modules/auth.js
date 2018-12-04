import { fromJS } from 'immutable';
import { apiPath } from 'config';

const ADD_NEW_COLLECTION = 'wr/auth/ADD_NEW_COLLECTION';
const COLLECTION_DELETION = 'wr/auth/COLLECTION_DELETION';
const INCR_COLL_COUNT = 'wr/auth/INCR_COLL_COUNT';

const LOAD = 'wr/auth/LOAD';
const LOAD_SUCCESS = 'wr/auth/LOAD_SUCCESS';
const LOAD_FAIL = 'wr/auth/LOAD_FAIL';

const LOGIN = 'wr/auth/LOGIN';
export const LOGIN_SUCCESS = 'wr/auth/LOGIN_SUCCESS';
const LOGIN_FAIL = 'wr/auth/LOGIN_FAIL';

const LOGOUT = 'wr/auth/LOGOUT';
export const LOGOUT_SUCCESS = 'wr/auth/LOGOUT_SUCCESS';
const LOGOUT_FAIL = 'wr/auth/LOGOUT_FAIL';

const SELECT_COLLECTION = 'wr/auth/SELECT_COLLECTION';

const USER_DELETE = 'wr/auth/DELETE';
const USER_DELETE_SUCCESS = 'wr/auth/DELETE_SUCCESS';
const USER_DELETE_FAIL = 'wr/auth/DELETE_FAIL';

const USER_LOAD_COLLECTIONS = 'wr/auth/USER_LOAD_COLLECTIONS';
const USER_LOAD_COLLECTIONS_SUCCESS = 'wr/auth/USER_LOAD_COLLECTIONS_SUCCESS';
const USER_LOAD_COLLECTIONS_FAIL = 'wr/auth/USER_LOAD_COLLECTIONS_FAIL';

const USER_PASS = 'wr/auth/PASS';
const USER_PASS_SUCCESS = 'wr/auth/PASS_SUCCESS';
const USER_PASS_FAIL = 'wr/auth/PASS_FAIL';

const USER_ROLES = 'wr/auth/USER_ROLES';
const USER_ROLES_SUCCESS = 'wr/auth/USER_ROLES_SUCCESS';
const USER_ROLES_FAIL = 'wr/auth/USER_ROLES_FAIL';

const defaultUser = fromJS({
  username: null,
  role: null,
  anon: null,
  num_collections: 0,
  space_utilization: {
    used: undefined,
    available: undefined,
    total: undefined
  }
});

const initialState = fromJS({
  accessed: null,
  activeCollection: null,
  deleting: false,
  deleteErorr: null,
  loaded: false,
  loading: false,
  passUpdate: false,
  passUpdateFail: null,
  roles: [],
  user: defaultUser
});


export function auth(state = initialState, action = {}) {
  switch (action.type) {
    case ADD_NEW_COLLECTION:
      return state.setIn(['user', 'collections'], state.getIn(['user', 'collections']).push(fromJS(action.coll)));

    case COLLECTION_DELETION: {
      const collections = state.getIn(['user', 'collections']);
      const idx = collections.findIndex(c => c.get('id') === action.id);
      return state.setIn(['user', 'collections'], collections.delete(idx));
    }

    case INCR_COLL_COUNT:
      return state.setIn(['user', 'num_collections'], state.getIn(['user', 'num_collections']) + action.incr);

    case LOAD:
      return state.set('loading', true);
    case LOAD_SUCCESS:
      return state.merge({
        accessed: action.accessed,
        loading: false,
        loaded: true,
        user: fromJS(action.result.user)
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
        accessed: action.accessed,
        loggingIn: false,
        loginError: null,
        loaded: true,
        user: fromJS(action.result.user)
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

    case SELECT_COLLECTION:
      return state.set('activeCollection', action.id);

    case USER_DELETE:
      return state.set('deleting', true);
    case USER_DELETE_SUCCESS:
      return state.set('deleting', false);
    case USER_DELETE_FAIL:
      return state.merge({
        deleting: false,
        deleteErorr: action.error.error
      });

    case USER_LOAD_COLLECTIONS:
      return state.set('loading', true);
    case USER_LOAD_COLLECTIONS_SUCCESS: {
      const s = state.setIn(['user', 'collections'], fromJS(action.result.collections));
      return s.set('loading', false);
    }
    case USER_PASS_SUCCESS:
      return state.merge({
        passUpdate: true,
        passUpdateFail: null
      });
    case USER_PASS_FAIL:
      return state.set('passUpdateFail', action.error.error);

    case USER_ROLES_SUCCESS:
      return state.merge({
        roles: action.result.roles
      });
    default:
      return state;
  }
}


export function addUserCollection(coll) {
  return {
    type: ADD_NEW_COLLECTION,
    coll
  };
}


export function deleteUser(user) {
  return {
    types: [USER_DELETE, USER_DELETE_SUCCESS, USER_DELETE_FAIL],
    promise: client => client.del(`${apiPath}/user/${user}`)
  };
}


export function deleteUserCollection(id) {
  return {
    type: COLLECTION_DELETION,
    id
  };
}


export function incrementCollCount(incr) {
  return {
    type: INCR_COLL_COUNT,
    incr: incr || 0
  };
}


export function isLoaded({ app }) {
  if (app.getIn(['auth', 'user', 'anon']) === true) {
    return app.getIn(['auth', 'user', 'num_collections']);
  }

  return app.get('auth') && app.getIn(['auth', 'loaded']);
}


export function load(include_colls = true) {
  return {
    types: [LOAD, LOAD_SUCCESS, LOAD_FAIL],
    accessed: Date.now(),
    promise: client => client.get(`${apiPath}/auth/curr_user`, {
      params: { include_colls }
    })
  };
}


export function loadCollections(user) {
  return {
    types: [USER_LOAD_COLLECTIONS, USER_LOAD_COLLECTIONS_SUCCESS, USER_LOAD_COLLECTIONS_FAIL],
    promise: client => client.get(`${apiPath}/collections`, {
      params: {
        user,
        include_recordings: false,
        include_lists: false
      }
    })
  };
}


export function loadRoles() {
  return {
    types: [USER_ROLES, USER_ROLES_SUCCESS, USER_ROLES_FAIL],
    promise: client => client.get(`${apiPath}/admin/user_roles`)
  };
}


export function login(postData) {
  return {
    types: [LOGIN, LOGIN_SUCCESS, LOGIN_FAIL],
    accessed: Date.now(),
    promise: client => client.post(`${apiPath}/auth/login`, {
      params: { include_colls: true },
      data: {
        ...postData
      }
    })
  };
}


export function logout() {
  return {
    types: [LOGOUT, LOGOUT_SUCCESS, LOGOUT_FAIL],
    promise: client => client.post(`${apiPath}/auth/logout`)
  };
}


export function selectCollection(id) {
  return {
    type: SELECT_COLLECTION,
    id
  };
}


export function updatePassword(currPass, newPass, newPass2) {
  return {
    types: [USER_PASS, USER_PASS_SUCCESS, USER_PASS_FAIL],
    promise: client => client.post(`${apiPath}/auth/password/update`, {
      data: {
        currPass,
        newPass,
        newPass2
      }
    })
  };
}
