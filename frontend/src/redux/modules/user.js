import { fromJS } from 'immutable';
import config from 'config';


const USER_DELETE = 'wr/user/DELETE';
const USER_DELETE_SUCCESS = 'wr/user/DELETE_SUCCESS';
const USER_DELETE_FAIL = 'wr/user/DELETE_FAIL';
const USER_DELETE_TOKEN = 'wr/user/DELETE_TOKEN';
const USER_DELETE_TOKEN_SUCCESS = 'wr/user/DELETE_TOKEN_SUCCESS';
const USER_DELETE_TOKEN_FAIL = 'wr/user/DELETE_TOKEN_FAIL';
const USER_LOAD = 'wr/user/LOAD';
const USER_LOAD_SUCCESS = 'wr/user/LOAD_SUCCESS';
const USER_LOAD_FAIL = 'wr/user/LOAD_FAIL';
const USER_LOAD_COLLECTIONS = 'wr/user/USER_LOAD_COLLECTIONS';
const USER_LOAD_COLLECTIONS_SUCCESS = 'wr/user/USER_LOAD_COLLECTIONS_SUCCESS';
const USER_LOAD_COLLECTIONS_FAIL = 'wr/user/USER_LOAD_COLLECTIONS_FAIL';
const USER_PASS = 'wr/user/PASS';
const USER_PASS_SUCCESS = 'wr/user/PASS_SUCCESS';
const USER_PASS_FAIL = 'wr/user/PASS_FAIL';

const ADD_NEW_COLLECTION = 'wr/user/ADD_NEW_COLLECTION';
const SELECT_COLLECTION = 'wr/user/SELECT_COLLECTION';
const COLLECTION_DELETION = 'wr/user/COLLECTION_DELETION';

const initialState = fromJS({
  loading: false,
  loaded: false,
  accessed: null,
  error: null,
  activeCollection: null,
  space_utilization: {},
  collections: []
});

export default function user(state = initialState, action = {}) {
  switch (action.type) {
    case USER_LOAD:
      return state.set('loading', true);
    case USER_LOAD_SUCCESS: {
      const {
        collections,
        space_utilization,
        username
      } = action.result.user;

      return state.merge({
        loading: false,
        loaded: true,
        accessed: action.accessed,
        error: null,

        activeCollection: collections ? collections[0].id : null,
        collections,
        space_utilization,
        username
      });
    }
    case USER_LOAD_FAIL:
      return state.merge({
        loading: false,
        loaded: false,
        error: action.error
      });
    case USER_LOAD_COLLECTIONS_SUCCESS:
      return state.merge({
        collections: action.result.collections
      });
    case ADD_NEW_COLLECTION:
      return state.merge({
        collections: state.get('collections').push(fromJS(action.coll))
      });
    case SELECT_COLLECTION:
      return state.set('activeCollection', action.id);
    case COLLECTION_DELETION: {
      const collections = state.get('collections');
      const idx = collections.findIndex(c => c.get('id') === action.id);
      return state.set('collections', collections.delete(idx));
    }
    case USER_PASS_SUCCESS:
      return state.merge({
        passUpdate: true,
        passUpdateFail: null
      });
    case USER_PASS_FAIL:
      return state.set('passUpdateFail', action.error.error);
    default:
      return state;
  }
}

// TODO: eval csrf
export function getDeleteToken(user) {
  return {
    types: [USER_DELETE_TOKEN, USER_DELETE_TOKEN_SUCCESS, USER_DELETE_TOKEN_FAIL],
    promise: client => client.get(`${config.apiPath}/delete_token`)
  };
}

export function deleteUser(user) {
  return {
    types: [USER_DELETE, USER_DELETE_SUCCESS, USER_DELETE_FAIL],
    promise: client => client.del(`${config.apiPath}/user/${user}`)
  };
}

export function isLoaded({ app }) {
  return app.get('user') &&
         app.getIn(['user', 'loaded']);
}

export function load(username) {
  return {
    types: [USER_LOAD, USER_LOAD_SUCCESS, USER_LOAD_FAIL],
    accessed: Date.now(),
    promise: client => client.get(`${config.apiPath}/user/${username}`, {
      params: { include_colls: true }
    })
  };
}

export function loadCollections(user) {
  return {
    types: [USER_LOAD_COLLECTIONS, USER_LOAD_COLLECTIONS_SUCCESS, USER_LOAD_COLLECTIONS_FAIL],
    promise: client => client.get(`${config.apiPath}/collections`, {
      params: {
        user,
        include_recordings: false,
        include_lists: false
      }
    })
  };
}

export function addUserCollection(coll) {
  return {
    type: ADD_NEW_COLLECTION,
    coll
  };
}

export function selectCollection(id) {
  return {
    type: SELECT_COLLECTION,
    id
  };
}

export function deleteUserCollection(id) {
  return {
    type: COLLECTION_DELETION,
    id
  };
}

export function updatePassword(currPass, newPass, newPass2) {
  return {
    types: [USER_PASS, USER_PASS_SUCCESS, USER_PASS_FAIL],
    promise: client => client.post(`${config.apiPath}/auth/updatepassword`, {
      data: {
        currPass,
        newPass,
        newPass2
      }
    })
  };
}
