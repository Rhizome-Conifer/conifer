import { fromJS } from 'immutable';
import config from 'config';

const COLLS_LOAD = 'wr/colls/LOAD';
const COLLS_LOAD_SUCCESS = 'wr/colls/LOAD_SUCCESS';
const COLLS_LOAD_FAIL = 'wr/colls/LOAD_FAIL';

const initialState = fromJS({
  loading: false,
  loaded: false,
  error: null,
});

export default function collections(state = initialState, action = {}) {
  switch (action.type) {
    case COLLS_LOAD:
      return state.set('loading', true);
    case COLLS_LOAD_SUCCESS:
      return state.merge({
        loading: false,
        loaded: true,
        accessed: action.accessed,
        error: null,

        user: action.result.user,
        collections: action.result.collections
      });
    case COLLS_LOAD_FAIL:
      return state.merge({
        loading: false,
        loaded: false,
        error: action.error
      });
    default:
      return state;
  }
}

export function isLoaded(globalState) {
  return globalState.get('collections') &&
         globalState.getIn(['collections', 'loaded']);
}

export function load(username) {
  return {
    types: [COLLS_LOAD, COLLS_LOAD_SUCCESS, COLLS_LOAD_FAIL],
    accessed: Date.now(),
    promise: client => client.get(`${config.apiPath}/collections?user=${username}`)
  };
}
