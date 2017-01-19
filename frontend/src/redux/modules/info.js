const INFO_LOAD = 'wr/info/LOAD';
const INFO_LOAD_SUCCESS = 'wr/info/LOAD_SUCCESS';
const INFO_LOAD_FAIL = 'wr/info/LOAD_FAIL';

const initialState = {
  loaded: false
};

export default function info(state = initialState, action = {}) {
  switch (action.type) {
    case INFO_LOAD:
      return {
        ...state,
        loading: true
      };
    case INFO_LOAD_SUCCESS:
      return {
        ...state,
        loading: false,
        loaded: true,
        data: action.result.user
      };
    case INFO_LOAD_FAIL:
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
  return globalState.info && globalState.info.loaded;
}

export function load(username) {
  return {
    types: [INFO_LOAD, INFO_LOAD_SUCCESS, INFO_LOAD_FAIL],
    promise: client => client.get(`/users/${username}?api=false&include_recs=false`)
  };
}
