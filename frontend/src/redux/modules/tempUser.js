import { fromJS } from 'immutable';

import { apiPath } from 'config';

const TEMP_LOAD = 'wr/tempUser/TEMP_LOAD';
const TEMP_LOAD_SUCCESS = 'wr/tempUser/TEMP_LOAD_SUCCESS';
const TEMP_LOAD_FAIL = 'wr/tempUser/TEMP_LOAD_FAIL';

const initialState = fromJS({
  loading: false,
  loaded: false,
  error: null,
  user: null,
});

export default function tempUser(state = initialState, action = {}) {
  switch (action.type) {
    case TEMP_LOAD:
      return state.merge({
        loading: true,
        loaded: false
      });
    case TEMP_LOAD_SUCCESS:
      return state.merge({
        user: {
          accessed: action.accessed,
          ...action.result.user,
        }
      });
    case TEMP_LOAD_FAIL:
      return state.set('error', true);
    default:
      return state;
  }
}

export function load(username) {
  return {
    types: [TEMP_LOAD, TEMP_LOAD_SUCCESS, TEMP_LOAD_FAIL],
    accessed: Date.now(),
    promise: client => client.get(`${apiPath}/user/${username}`)
  };
}
