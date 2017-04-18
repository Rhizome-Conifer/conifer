const RB_LOAD = 'wr/rb/LOAD';
const RB_LOAD_SUCCESS = 'wr/rb/LOAD_SUCCESS';
const RB_LOAD_FAIL = 'wr/rb/LOAD_FAIL';

const initialState = {
  loaded: false
};

export default function remoteBrowsers(state = initialState, action = {}) {
  switch (action.type) {
    case RB_LOAD:
      return {
        ...state,
        loading: true
      };
    case RB_LOAD_SUCCESS:
      return {
        ...state,
        loading: false,
        loaded: true,
        browsers: action.result
      };
    case RB_LOAD_FAIL:
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
  return globalState.remoteBrowsers && globalState.remoteBrowsers.loaded;
}

export function load() {
  return {
    types: [RB_LOAD, RB_LOAD_SUCCESS, RB_LOAD_FAIL],
    promise: client => client.get('/api/browsers/browsers')
  };
}
