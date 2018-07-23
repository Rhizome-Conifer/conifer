import { fromJS } from 'immutable';
import { apiPath } from 'config';


const USER_DELETE = 'wr/user/DELETE';
const USER_DELETE_SUCCESS = 'wr/user/DELETE_SUCCESS';
const USER_DELETE_FAIL = 'wr/user/DELETE_FAIL';

const USER_LOAD = 'wr/user/LOAD';
const USER_LOAD_SUCCESS = 'wr/user/LOAD_SUCCESS';
const USER_LOAD_FAIL = 'wr/user/LOAD_FAIL';

const USER_LOAD_COLLECTIONS = 'wr/user/USER_LOAD_COLLECTIONS';
const USER_LOAD_COLLECTIONS_SUCCESS = 'wr/user/USER_LOAD_COLLECTIONS_SUCCESS';
const USER_LOAD_COLLECTIONS_FAIL = 'wr/user/USER_LOAD_COLLECTIONS_FAIL';

const USER_PASS = 'wr/user/PASS';
const USER_PASS_SUCCESS = 'wr/user/PASS_SUCCESS';
const USER_PASS_FAIL = 'wr/user/PASS_FAIL';

const USER_UPDATE = 'wr/user/UPDATE';
const USER_UPDATE_SUCCESS = 'wr/user/UPDATE_SUCCESS';
const USER_UPDATE_FAIL = 'wr/user/UPDATE_FAIL';

const ADD_NEW_COLLECTION = 'wr/user/ADD_NEW_COLLECTION';
const SELECT_COLLECTION = 'wr/user/SELECT_COLLECTION';
const COLLECTION_DELETION = 'wr/user/COLLECTION_DELETION';


const initialState = fromJS({
  accessed: null,
  activeCollection: null,
  collections: [],
  deleting: false,
  deleteErorr: null,
  error: null,
  loading: false,
  loaded: false,
  passUpdate: false,
  passUpdateFail: null,
  space_utilization: {}
});


export default function user(state = initialState, action = {}) {
  switch (action.type) {
    case USER_DELETE:
      return state.set('deleting', true);
    case USER_DELETE_SUCCESS:
      return state.set('deleting', false);
    case USER_DELETE_FAIL:
      return state.merge({
        deleting: false,
        deleteErorr: action.error.error
      });
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
    case USER_LOAD_COLLECTIONS:
      return state.set('loading', true);
    case USER_LOAD_COLLECTIONS_SUCCESS:
      return state.merge({
        collections: action.result.collections,
        loading: false
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
    case USER_UPDATE_SUCCESS:
      return state.merge({
        space_utilization: action.result.user.space_utilization
      });
    default:
      return state;
  }
}


export function deleteUser(user) {
  return {
    types: [USER_DELETE, USER_DELETE_SUCCESS, USER_DELETE_FAIL],
    promise: client => client.del(`${apiPath}/user/${user}`)
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
    promise: client => client.get(`${apiPath}/user/${username}`, {
      params: { include_colls: true }
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
    promise: client => client.post(`${apiPath}/auth/password/update`, {
      data: {
        currPass,
        newPass,
        newPass2
      }
    })
  };
}


export function updateUser(user, data) {
  return {
    types: [USER_UPDATE, USER_UPDATE_SUCCESS, USER_UPDATE_FAIL],
    promise: client => client.put(`${apiPath}/admin/user/${user}`, {
      data
    })
  };
}
