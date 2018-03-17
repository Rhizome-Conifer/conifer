import { apiPath } from 'config';
import { fromJS } from 'immutable';

const COLL_LOAD = 'wr/coll/COLL_LOAD';
const COLL_LOAD_SUCCESS = 'wr/coll/COLL_LOAD_SUCCESS';
const COLL_LOAD_FAIL = 'wr/coll/COLL_LOAD_FAIL';

const COLL_DESC = 'wr/coll/COLL_DESC';
const COLL_DESC_SUCCESS = 'wr/coll/COLL_DESC_SUCCESS';
const COLL_DESC_FAIL = 'wr/coll/COLL_DESC_FAIL';
const RESET_SAVE_STATE = 'wr/coll/RESET_SAVE_STATE';

const COLL_DELETE = 'wr/coll/COLL_DELETE';
const COLL_DELETE_SUCCESS = 'wr/coll/COLL_DELETE_SUCCESS';
const COLL_DELETE_FAIL = 'wr/coll/COLL_DELETE_FAIL';

const LISTS_LOAD = 'wr/coll/LISTS_LOAD';
const LISTS_LOAD_SUCCESS = 'wr/coll/LISTS_LOAD_SUCCESS';
const LISTS_LOAD_FAIL = 'wr/coll/LISTS_LOAD_FAIL';

const COLL_SET_SORT = 'wr/coll/COLL_SET_SORT';
const COLL_SET_PUBLIC = 'wr/coll/SET_PUBLIC';
const COLL_SET_PUBLIC_SUCCESS = 'wr/coll/SET_PUBLIC_SUCCESS';
const COLL_SET_PUBLIC_FAIL = 'wr/coll/SET_PUBLIC_FAIL';

export const defaultSort = { sort: 'timestamp', dir: 'DESC' };
const initialState = fromJS({
  descSave: false,
  loading: false,
  loaded: false,
  error: null,
  sortBy: defaultSort
});


export default function collection(state = initialState, action = {}) {
  switch (action.type) {
    case COLL_LOAD:
      return state.set('loading', true);
    case COLL_LOAD_SUCCESS: {
      const {
        bookmarks,
        collection: { created_at, desc, download_url, id, lists, recordings, size, title },
        user
      } = action.result;

      const bks = {};
      bookmarks.forEach((bookmark) => { bks[bookmark.id] = bookmark; });

      return state.merge({
        loading: false,
        loaded: true,
        accessed: action.accessed,
        error: null,

        pages: bks,
        created_at,
        desc,
        download_url,
        id,
        isPublic: action.result.collection['r:@public'],
        lists,
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

    case COLL_SET_SORT:
      return state.merge({
        sortBy: action.sortBy
      });

    case LISTS_LOAD_SUCCESS:
      return state.merge({
        lists: action.result.lists
      });

    case COLL_DESC_SUCCESS:
      return state.set('descSave', true);
    case RESET_SAVE_STATE:
      return state.set('descSave', false);

    case LISTS_LOAD_FAIL:
    case LISTS_LOAD:
    case COLL_SET_PUBLIC:
    case COLL_SET_PUBLIC_FAIL:
    default:
      return state;
  }
}


export function isLoaded({ app }) {
  return app.get('collection') &&
         app.getIn(['collection', 'loaded']) &&
         Date.now() - app.getIn(['collection', 'accessed']) < 15 * 60 * 1000;
}


export function resetSaveState() {
  return { type: RESET_SAVE_STATE };
}


export function load(user, coll) {
  return {
    types: [COLL_LOAD, COLL_LOAD_SUCCESS, COLL_LOAD_FAIL],
    accessed: Date.now(),
    promise: client => client.get(`${apiPath}/collections/${coll}`, {
      params: { user }
    })
  };
}


export function loadLists(user, coll, withBookmarks = false) {
  return {
    types: [LISTS_LOAD, LISTS_LOAD_SUCCESS, LISTS_LOAD_FAIL],
    promise: client => client.get(`${apiPath}/lists`, {
      params: { user, coll, include_bookmarks: withBookmarks }
    })
  };
}


export function saveDescription(user, coll, desc) {
  return {
    types: [COLL_DESC, COLL_DESC_SUCCESS, COLL_DESC_FAIL],
    promise: client => client.post(`${apiPath}/collections/${coll}/desc`, {
      params: { user, coll },
      data: desc
    }, 'form')
  };
}


export function setPublic(coll, user, makePublic = true) {
  return {
    types: [COLL_SET_PUBLIC, COLL_SET_PUBLIC_SUCCESS, COLL_SET_PUBLIC_FAIL],
    promise: client => client.post(`${apiPath}/collections/${coll}/public`, {
      params: { user },
      data: {
        'public': makePublic
      },
    }, 'form')
  };
}


export function deleteCollection(user, coll) {
  return {
    types: [COLL_DELETE, COLL_DELETE_SUCCESS, COLL_DELETE_FAIL],
    promise: client => client.del(`${apiPath}/collections/${coll}`, {
      params: { user }
    })
  };
}


export function setSort(sortBy) {
  return {
    type: COLL_SET_SORT,
    sortBy
  };
}
