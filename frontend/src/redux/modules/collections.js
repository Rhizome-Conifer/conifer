const COLLS_LOAD = 'wr/colls/LOAD';
const COLLS_LOAD_SUCCESS = 'wr/colls/LOAD_SUCCESS';
const COLLS_LOAD_FAIL = 'wr/colls/LOAD_FAIL';

const initialState = {
  loaded: false
};

export default function collections(state = initialState, action = {}) {
  switch (action.type) {
    case COLLS_LOAD:
      return {
        ...state,
        loading: true
      };
    case COLLS_LOAD_SUCCESS:
      return {
        ...state,
        loading: false,
        loaded: true,
        collections: action.result.collections
      };
    case COLLS_LOAD_FAIL:
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
  return globalState.colls && globalState.colls.loaded;
}

export function load(username) {
  return {
    types: [COLLS_LOAD, COLLS_LOAD_SUCCESS, COLLS_LOAD_FAIL],
    promise: client => client.get(`collections?user=${username}`)
  };
}
