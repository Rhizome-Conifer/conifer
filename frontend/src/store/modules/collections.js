import { fromJS } from 'immutable';
import config from 'config';

const COLLS_LOAD = 'wr/colls/LOAD';
const COLLS_LOAD_SUCCESS = 'wr/colls/LOAD_SUCCESS';
const COLLS_LOAD_FAIL = 'wr/colls/LOAD_FAIL';

const CREATE_COLL = 'wr/coll/CREATE_COLL';
const CREATE_COLL_SUCCESS = 'wr/coll/CREATE_COLL_SUCCESS';
const CREATE_COLL_FAIL = 'wr/coll/CREATE_COLL_FAIL';

const initialState = fromJS({
  creationErorr: null,
  loading: false,
  loaded: false,
  error: null,
  creatingCollection: false,
  accessed: null
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

        user: fromJS(action.result.user),
        collections: fromJS(action.result.collections)
      });
    case COLLS_LOAD_FAIL:
      return state.merge({
        loading: false,
        loaded: false,
        error: action.error
      });

    case CREATE_COLL:
      return state.merge({
        creatingCollection: true,
        creationErorr: null
      });
    case CREATE_COLL_SUCCESS:
      return state.merge({
        newCollection: action.result.collection.id,
        creatingCollection: false,
        creationErorr: null,
        // nullify collections cache
        accessed: null
      });
    case CREATE_COLL_FAIL:
      return state.set('creationErorr', action.error.error);

    default:
      return state;
  }
}

export function isLoaded({ app }) {
  return app.get('collections') &&
         app.getIn(['collections', 'loaded']);
}

export function createCollection(user, title, makePublic = false) {
  return {
    types: [CREATE_COLL, CREATE_COLL_SUCCESS, CREATE_COLL_FAIL],
    promise: client => client.post(`${config.apiPath}/collections`, {
      params: { user },
      data: {
        title,
        'public': makePublic,
        public_index: true
      }
    })
  };
}

export function load(user) {
  return {
    types: [COLLS_LOAD, COLLS_LOAD_SUCCESS, COLLS_LOAD_FAIL],
    accessed: Date.now(),
    promise: client => client.get(`${config.apiPath}/collections`, {
      params: { user, include_pages: false, include_recordings: false, include_lists: false }
    })
  };
}
