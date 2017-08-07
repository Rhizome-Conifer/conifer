import config from 'config';

const COLL_LOAD = 'wr/coll/LOAD';
const COLL_LOAD_SUCCESS = 'wr/coll/LOAD_SUCCESS';
const COLL_LOAD_FAIL = 'wr/coll/LOAD_FAIL';

const initialState = {
  loaded: false
};

export default function collection(state = initialState, action = {}) {
  switch (action.type) {
    case COLL_LOAD:
      return {
        ...state,
        loading: true
      };
    case COLL_LOAD_SUCCESS:
      return {
        ...state,
        loading: false,
        loaded: true,
        accessed: Date.now(),
        ...action.result
      };
    case COLL_LOAD_FAIL:
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
  return globalState.collection && globalState.collection.loaded;
}

export function load(username, coll) {
  return {
    types: [COLL_LOAD, COLL_LOAD_SUCCESS, COLL_LOAD_FAIL],
    promise: client => client.get(`${config.apiPath}/collections/${coll}?user=${username}`)
  };
}
