import config from 'config';

const USER_LOAD = 'wr/user/LOAD';
const USER_LOAD_SUCCESS = 'wr/user/LOAD_SUCCESS';
const USER_LOAD_FAIL = 'wr/user/LOAD_FAIL';

const initialState = {
  loaded: false
};

export default function user(state = initialState, action = {}) {
  switch (action.type) {
    case USER_LOAD:
      return {
        ...state,
        loading: true
      };
    case USER_LOAD_SUCCESS:
      return {
        ...state,
        loading: false,
        loaded: true,
        data: action.result.user
      };
    case USER_LOAD_FAIL:
      return {
        ...state,
        loading: false,
        loaded: false,
        error: action.error
      };
    default:
      return state;
  }
}

export function isLoaded(globalState) {
  return globalState.user && globalState.user.loaded;
}

export function load(username) {
  return {
    types: [USER_LOAD, USER_LOAD_SUCCESS, USER_LOAD_FAIL],
    promise: client => client.get(`${config.apiPath}/users/${username}?api=false&include_recs=false`)
  };
}
