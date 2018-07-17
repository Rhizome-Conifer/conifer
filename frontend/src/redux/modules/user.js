import { fromJS } from 'immutable';
import { apiPath } from 'config';


const USER_LOAD = 'wr/user/LOAD';
const USER_LOAD_SUCCESS = 'wr/user/LOAD_SUCCESS';
const USER_LOAD_FAIL = 'wr/user/LOAD_FAIL';

const USER_UPDATE = 'wr/user/UPDATE';
const USER_UPDATE_SUCCESS = 'wr/user/UPDATE_SUCCESS';
const USER_UPDATE_FAIL = 'wr/user/UPDATE_FAIL';


const initialState = fromJS({
  error: null,
  loading: false,
  loaded: false
});


export default function user(state = initialState, action = {}) {
  switch (action.type) {
    case USER_LOAD:
      return state.set('loading', true);
    case USER_LOAD_SUCCESS:
      return state.merge({
        loading: false,
        loaded: true,
        error: null,
        ...action.result.user
      });
    case USER_LOAD_FAIL:
      return state.merge({
        loading: false,
        loaded: false,
        error: action.error
      });
    case USER_UPDATE_SUCCESS:
      return state.merge({
        ...action.result.user
      });
    default:
      return state;
  }
}


export function isLoaded({ app }) {
  return app.get('user') &&
         app.getIn(['user', 'loaded']);
}


export function load(username, include_colls = true) {
  return {
    types: [USER_LOAD, USER_LOAD_SUCCESS, USER_LOAD_FAIL],
    promise: client => client.get(`${apiPath}/user/${username}`, {
      params: { include_colls }
    })
  };
}


export function updateUser(username, data) {
  return {
    types: [USER_UPDATE, USER_UPDATE_SUCCESS, USER_UPDATE_FAIL],
    promise: client => client.put(`${apiPath}/admin/user/${username}`, {
      data
    })
  };
}
