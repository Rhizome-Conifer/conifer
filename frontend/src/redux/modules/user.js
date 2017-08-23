import { fromJS } from 'immutable';
import config from 'config';

const USER_LOAD = 'wr/user/LOAD';
const USER_LOAD_SUCCESS = 'wr/user/LOAD_SUCCESS';
const USER_LOAD_FAIL = 'wr/user/LOAD_FAIL';
const SELECT_COLLECTION = 'wr/user/SELECT_COLLECTION';

const initialState = fromJS({
  loading: false,
  loaded: false,
  accessed: null,
  activeCollection: null,
  space_utilization: {},
  colletions: []
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
    default:
      return state;
  }
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
