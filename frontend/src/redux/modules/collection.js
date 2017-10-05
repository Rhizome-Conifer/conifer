import config from 'config';
import { fromJS } from 'immutable';

const COLL_LOAD = 'wr/coll/LOAD';
const COLL_LOAD_SUCCESS = 'wr/coll/LOAD_SUCCESS';
const COLL_LOAD_FAIL = 'wr/coll/LOAD_FAIL';

const COLL_SET_PUBLIC = 'wr/coll/SET_PUBLIC';
const COLL_SET_PUBLIC_SUCCESS = 'wr/coll/SET_PUBLIC_SUCCESS';
const COLL_SET_PUBLIC_FAIL = 'wr/coll/SET_PUBLIC_FAIL';

const initialState = fromJS({
  loading: false,
  loaded: false,
  error: null,
});


export default function collection(state = initialState, action = {}) {
  switch (action.type) {
    case COLL_LOAD:
      return state.set('loading', true);
    case COLL_LOAD_SUCCESS: {
      const {
        bookmarks,
        collection: { created_at, desc, download_url, id, recordings, size, title },
        user
      } = action.result;

      return state.merge({
        loading: false,
        loaded: true,
        accessed: action.accessed,
        error: null,

        bookmarks,
        created_at,
        desc,
        download_url,
        id,
        isPublic: action.result.collection['r:@public'],
        recordings,
        size,
        title,
        user,
      });
    }
    case COLL_LOAD_FAIL:
      return state.merge({
        loading: false,
        loaded: false,
        error: action.error
      });
    case COLL_SET_PUBLIC_SUCCESS:
      return state.set('isPublic', action.result.is_public);
    case COLL_SET_PUBLIC:
    case COLL_SET_PUBLIC_FAIL:
    default:
      return state;
  }
}

export function isLoaded(globalState) {
  return globalState.get('collection') &&
         globalState.getIn(['collection', 'loaded']);
}

export function load(username, coll) {
  return {
    types: [COLL_LOAD, COLL_LOAD_SUCCESS, COLL_LOAD_FAIL],
    accessed: Date.now(),
    promise: client => client.get(`${config.apiPath}/collections/${coll}?user=${username}`)
  };
}

export function setPublic(coll, user, makePublic = true) {
  return {
    types: [COLL_SET_PUBLIC, COLL_SET_PUBLIC_SUCCESS, COLL_SET_PUBLIC_FAIL],
    promise: client => client.post(`${config.apiPath}/collections/${coll}/public?user=${user}`, {
      data: {
        'public': makePublic
      },
    }, 'form')
  };
}
