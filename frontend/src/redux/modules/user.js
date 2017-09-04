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
const USER_PASS = 'wr/user/PASS';
const USER_PASS_SUCCESS = 'wr/user/PASS_SUCCESS';
const USER_PASS_FAIL = 'wr/user/PASS_FAIL';
const SELECT_COLLECTION = 'wr/user/SELECT_COLLECTION';

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
        space_utilization
      } = action.result.user;

      return state.merge({
        loading: false,
        loaded: true,
        accessed: action.accessed,
        error: null,

        activeCollection: collections ? collections[0].id : null,
        collections,
        space_utilization,
        username: action.username
      });
    }
    case USER_LOAD_FAIL:
      return state.merge({
        loading: false,
        loaded: false,
        error: action.error
      });
    case SELECT_COLLECTION:
      return state.set('activeCollection', action.id);
    case USER_PASS_SUCCESS:
      return state.merge({
        passUpdate: true,
        passUpdateFail: null
      });
    case USER_PASS_FAIL:
      return state.set('passUpdateFail', action.error.error_message);
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
    promise: client => client.del(`${config.apiPath}/users/${user}`)
  };
}

export function isLoaded(globalState) {
  return globalState &&
         globalState.get('user') &&
         globalState.getIn(['user', 'loaded']);
}

export function load(username) {
  return {
    types: [USER_LOAD, USER_LOAD_SUCCESS, USER_LOAD_FAIL],
    accessed: Date.now(),
    username,
    promise: client => client.get(`${config.apiPath}/users/${username}?api=false&include_recs=false&include_colls=true`)
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
    promise: client => client.post(`${config.apiPath}/updatepassword`, {
      data: {
        currPass,
        newPass,
        newPass2
      }
    }, 'form')
  };
}
